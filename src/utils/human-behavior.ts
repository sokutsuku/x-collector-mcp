// src/utils/human-behavior.ts
// 人間らしい動作のためのユーティリティ関数

import { Page } from 'puppeteer';

/**
 * ランダムな待機時間
 */
export async function humanDelay(min: number, max: number): Promise<void> {
  const delay = Math.random() * (max - min) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 人間らしいマウス移動
 */
export async function humanMouseMove(page: Page): Promise<void> {
  const viewport = page.viewport();
  if (!viewport) return;

  // ランダムな座標に少しマウスを移動
  const x = Math.random() * viewport.width * 0.8 + viewport.width * 0.1;
  const y = Math.random() * viewport.height * 0.8 + viewport.height * 0.1;
  
  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
  await humanDelay(100, 300);
}

/**
 * 人間らしいスクロール（段階的に）
 */
export async function humanScroll(page: Page): Promise<void> {
  // 2-4回に分けてスクロール
  const scrollSteps = Math.floor(Math.random() * 3) + 2;
  const totalScroll = Math.random() * 600 + 400; // 400-1000px
  const stepScroll = totalScroll / scrollSteps;

  for (let i = 0; i < scrollSteps; i++) {
    await page.evaluate((scroll: number) => {
      (window as any).scrollBy(0, scroll);
    }, stepScroll);
    
    await humanDelay(100, 200);
  }
}

/**
 * ランダムなUser-Agent選択
 */
export function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * 自動化検出回避のための設定
 */
export async function setupAntiDetection(page: Page): Promise<void> {
  // 自動化検出を回避
  await page.evaluateOnNewDocument(() => {
    // @ts-ignore: This code runs in browser context where navigator exists
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
}

/**
 * 人間らしい読み込み待機
 */
export async function waitForPageLoad(page: Page, timeout: number = 30000): Promise<void> {
  await page.waitForNetworkIdle({ timeout });
  await humanDelay(2000, 4000); // 人間らしい待機
}