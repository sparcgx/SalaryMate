import { defineConfig } from 'vite';

const devices = {
  mobile: { label: '手機 390 × 844', width: 390, height: 844 },
  tablet: { label: '平板 820 × 1180', width: 820, height: 1180 },
  desktop: { label: '桌機 1366 × 900', width: 1366, height: 900 }
};

const visualPreview = () => ({
  name: 'salarymate-visual-preview',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const url = new URL(request.url || '/', 'http://preview.local');
      if (url.pathname !== '/__preview') return next();

      const deviceKey = Object.hasOwn(devices, url.searchParams.get('device'))
        ? url.searchParams.get('device')
        : 'mobile';
      const device = devices[deviceKey];
      const links = Object.entries(devices).map(([key, item]) => (
        `<a href="/__preview?device=${key}"${key === deviceKey ? ' aria-current="page"' : ''}>${item.label}</a>`
      )).join('');

      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>個人薪資管理裝置預覽｜${device.label}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body { display: grid; grid-template-rows: auto minmax(0, 1fr); background: #dbe8e7; color: #17373a; font: 14px/1.45 system-ui, sans-serif; }
    nav { display: flex; align-items: center; gap: 8px; padding: 10px 14px; overflow-x: auto; background: #fff; border-bottom: 1px solid #bfd2d0; box-shadow: 0 4px 18px rgba(23,55,58,.08); }
    strong { margin-right: 6px; white-space: nowrap; }
    a { color: #406064; text-decoration: none; white-space: nowrap; border: 1px solid #c8d8d6; border-radius: 999px; padding: 7px 11px; }
    a[aria-current="page"] { color: #fff; background: #087f74; border-color: #087f74; }
    main { overflow: auto; padding: 18px; text-align: center; }
    .device-label { margin: 0 0 10px; color: #537276; font-weight: 700; }
    iframe { box-sizing: content-box; display: block; width: ${device.width}px; height: ${device.height}px; margin: 0 auto 18px; background: #fff; border: 1px solid #adc4c1; border-radius: 22px; box-shadow: 0 22px 60px rgba(23,55,58,.2); }
  </style>
</head>
<body>
  <nav aria-label="預覽尺寸"><strong>v4.3.2 動態玻璃預覽</strong>${links}</nav>
  <main>
    <p class="device-label">${device.label}｜內容直接讀取 dist</p>
    <iframe src="/" title="個人薪資管理 ${device.label} 預覽"></iframe>
  </main>
</body>
</html>`);
    });
  }
});

export default defineConfig({
  root: 'dist',
  plugins: [visualPreview()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local']
  }
});
