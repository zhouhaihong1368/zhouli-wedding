# Render 部署指南 · 周礼婚礼管家

## 第一步：准备 GitHub 仓库

1. 打开 https://github.com ，注册/登录
2. 点击右上角 "+" → "New repository"
3. 仓库名填 `zhouli-wedding`，选择 **Private**（私密）
4. 不要勾选任何初始化选项，点 "Create repository"
5. 创建后，页面会显示上传指引

## 第二步：上传代码到 GitHub

在当前项目目录（C:\Users\周海红\WorkBuddy\Claw\）打开命令行，依次执行：

```
git init
git add .
git commit -m "周礼婚礼管家 - 初始版本"
git branch -M main
git remote add origin https://github.com/你的用户名/zhouli-wedding.git
git push -u origin main
```

## 第三步：部署到 Render

1. 打开 https://render.com ，用 GitHub 账号登录
2. 点击 "New +" → "PostgreSQL"
   - Name: `zhouli-wedding-db`
   - Database: `zhouli_wedding`
   - User: 默认即可
   - 点 "Create Database"
   - 记下自动生成的 **Internal Database URL**

3. 再点 "New +" → "Web Service"
   - 选择刚才上传的 `zhouli-wedding` 仓库
   - Name: `zhouli-wedding`
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - 在 Environment Variables 区域，点击 "Add from .env" 旁边，手动添加：
     - Key: `DATABASE_URL`，Value: 粘贴第2步记下的 Internal Database URL
     - Key: `ADMIN_PWD`，Value: 你的管理员密码（默认 8888）
   - 点击 "Create Web Service"

4. 等待部署完成（约 2-3 分钟），会得到一个 URL 类似：
   `https://zhouli-wedding.onrender.com`

## 第四步：更新前端 API 地址

把上面得到的 Render URL，替换 `index.html` 里的 `YOUR_APP.onrender.com`：

打开 `index.html`，找到：
```
const API_BASE='https://YOUR_APP.onrender.com';
```
改为：
```
const API_BASE='https://zhouli-wedding.onrender.com'; // 你的实际地址
```

## 第五步：重新部署前端

把更新后的 `index.html` 上传到 GitHub：
```
git add index.html
git commit -m "更新API地址"
git push
```

然后重新部署到 CloudStudio（和以前一样）。
---

## 注意事项

- **免费层限制**：15 分钟无访问后服务会休眠，首次唤醒约 30 秒
- **数据库免费**：PostgreSQL 免费 1GB 存储，对婚礼登记完全够用
- **不会再丢数据**：数据存储在 Render 云端，和你的电脑无关
- **不再需要启动本地服务器**：双击启动服务器.bat 不再需要
