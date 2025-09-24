const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const ICONS_DIR = path.join(__dirname, 'extension', 'icons');
const SIZES = [16, 48, 128];

async function generatePng(browser, size) {
    const svgFileName = `Chrome擴充功能管理器_icon-${size}.svg`;
    const pngFileName = `Chrome擴充功能管理器_icon-${size}.png`;
    const svgPath = path.join(ICONS_DIR, svgFileName);
    const pngPath = path.join(ICONS_DIR, pngFileName);

    try {
        console.log(`[開始] 正在處理 ${svgFileName}...`);
        
        const svgContent = await fs.readFile(svgPath, 'utf-8');
        const page = await browser.newPage();
        
        await page.setViewport({ width: size, height: size });
        await page.setContent(`<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body, html { margin: 0; padding: 0; }
                    body { width: ${size}px; height: ${size}px; }
                </style>
            </head>
            <body>
                ${svgContent}
            </body>
            </html>`);
        
        const svgElement = await page.$('svg');
        if (!svgElement) {
            throw new Error('在頁面中找不到 SVG 元素');
        }

        await svgElement.screenshot({
            path: pngPath,
            omitBackground: true,
        });

        await page.close();
        console.log(`[成功] ✅ 已生成 ${pngFileName}`);

    } catch (error) {
        console.error(`[錯誤] 處理 ${svgFileName} 時發生錯誤:`, error);
    }
}

async function main() {
    console.log('🚀 啟動 Puppeteer 生成圖標...');
    const browser = await puppeteer.launch();

    const tasks = SIZES.map(size => generatePng(browser, size));
    await Promise.all(tasks);

    await browser.close();
    console.log('🎉 所有圖標已成功生成！');
}

main();
