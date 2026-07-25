/**
 * 周礼婚礼管家 - 智能启动脚本
 * 自动启动服务器 + SSH隧道 + 更新前端API地址
 *
 * 用法: node 启动.js
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const NODE = process.execPath;
const SERVER_FILE = path.join(__dirname, 'server.js');
const INDEX_FILE = path.join(__dirname, 'index.html');

// 颜色输出
const c = {
  green: s => `\x1b[32m${s}\x1b[0m`,
  red: s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`
};

function log(msg) { console.log(`[${new Date().toLocaleTimeString('zh-CN')}] ${msg}`); }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 检查端口是否可用
function checkPort(port) {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${port}/api/config`, res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

// 等待服务器启动
async function waitForServer(port, maxWait = 10000) {
  for (let i = 0; i < maxWait / 500; i++) {
    if (await checkPort(port)) return true;
    await sleep(500);
  }
  return false;
}

// 启动 SSH 隧道 (localhost.run)
async function startSSHTunnel(port) {
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=15',
      '-R', `80:localhost:${port}`,
      'nokey@localhost.run'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let output = '';
    let tunnelUrl = null;

    child.stdout.on('data', data => {
      const text = data.toString();
      output += text;
      // 查找隧道URL
      const match = text.match(/https:\/\/[a-z0-9-]+\.(lhr\.life|localhost\.run)/);
      if (match && !tunnelUrl) {
        tunnelUrl = match[0];
      }
    });

    child.stderr.on('data', data => {
      process.stderr.write(data);
    });

    // 等待获取URL
    setTimeout(() => {
      if (tunnelUrl) {
        resolve({ url: tunnelUrl, process: child });
      } else {
        reject(new Error('获取隧道地址超时，请检查网络连接'));
      }
    }, 15000);

    child.on('exit', code => {
      if (!tunnelUrl) {
        reject(new Error(`SSH隧道进程退出，代码: ${code}`));
      }
    });
  });
}

// 更新 index.html 中的 TUNNEL_URL
function updateTunnelUrl(url) {
  let content = fs.readFileSync(INDEX_FILE, 'utf-8');
  const newContent = content.replace(
    /const TUNNEL_URL='[^']*';/,
    `const TUNNEL_URL='${url}';`
  );
  if (newContent !== content) {
    fs.writeFileSync(INDEX_FILE, newContent, 'utf-8');
    return true;
  }
  return false;
}

// 测试隧道连接
async function testTunnel(url) {
  const https = require('https');
  return new Promise(resolve => {
    const req = https.get(`${url}/api/config`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const config = JSON.parse(data);
          resolve(config.pwd !== undefined);
        } catch (e) {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(10000, () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  console.log(c.bold(c.cyan('\n========================================')));
  console.log(c.bold(c.cyan('  周礼婚礼管家 - 智能启动')));
  console.log(c.bold(c.cyan('========================================\n')));

  // 1. 检查服务器是否已在运行
  log('检查服务器状态...');
  const serverRunning = await checkPort(3000);

  let serverProcess = null;
  if (!serverRunning) {
    log('启动数据服务器 (端口 3000)...');
    serverProcess = spawn(NODE, [SERVER_FILE], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname
    });
    serverProcess.stdout.on('data', d => process.stdout.write(d));
    serverProcess.stderr.on('data', d => process.stderr.write(d));

    log('等待服务器启动...');
    const ok = await waitForServer(3000);
    if (!ok) {
      console.log(c.red('服务器启动失败！'));
      process.exit(1);
    }
  }
  console.log(c.green('  [OK] 数据服务器已运行\n'));

  // 2. 启动SSH隧道
  log('启动 SSH 隧道 (localhost.run)...');
  try {
    const { url, process: tunnelProc } = await startSSHTunnel(3000);
    console.log(c.green(`  [OK] 隧道地址: ${c.bold(url)}\n`));

    // 3. 测试隧道
    log('测试隧道连接...');
    await sleep(3);
    const tunnelOk = await testTunnel(url);
    if (tunnelOk) {
      console.log(c.green('  [OK] 隧道连接正常，数据可同步\n'));
    } else {
      console.log(c.yellow('  [警告] 隧道连接测试未通过，但可能仍可正常工作\n'));
    }

    // 4. 更新前端API地址
    log('更新前端API地址...');
    const updated = updateTunnelUrl(url);
    if (updated) {
      console.log(c.green(`  [OK] 已更新 index.html 中的隧道地址\n`));
    } else {
      console.log(c.yellow('  [跳过] 隧道地址未变化\n'));
    }

    // 5. 输出信息
    console.log(c.bold(c.cyan('========================================')));
    console.log(c.bold(c.green('  启动完成！\n')));
    console.log(`  ${c.bold('隧道地址(直接访问):')} ${url}`);
    console.log(`  ${c.bold('CloudStudio地址:')} https://5e818174a720463e825ea3d39e812b2f.app.codebuddy.work`);
    console.log(`  ${c.bold('分享给新人:')} https://5e818174a720463e825ea3d39e812b2f.app.codebuddy.work\n`);
    console.log(c.yellow('  注意:'));
    console.log(c.yellow('  - 隧道地址每次启动会变化，已自动更新到前端'));
    console.log(c.yellow('  - 如需同步到 CloudStudio，请联系助手重新部署'));
    console.log(c.yellow('  - 请勿关闭此窗口，保持服务器运行\n'));
    console.log(c.bold(c.cyan('========================================\n')));

    // 保持运行
    process.on('SIGINT', () => {
      console.log(c.yellow('\n正在关闭...'));
      if (tunnelProc) tunnelProc.kill();
      if (serverProcess) serverProcess.kill();
      process.exit(0);
    });

    setInterval(() => {}, 1000);

  } catch (e) {
    console.log(c.red(`  隧道启动失败: ${e.message}\n`));
    console.log(c.yellow('  服务器仍在运行，但无法从外网访问。'));
    console.log(c.yellow('  请检查网络连接后重试。\n'));
    process.exit(1);
  }
}

main().catch(e => {
  console.error(c.red('启动失败:'), e);
  process.exit(1);
});
