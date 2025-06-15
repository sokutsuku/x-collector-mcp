// src/utils/selectors.ts
// X(Twitter)のDOMセレクタを一元管理 - 2025年最新版

/**
 * ログイン関連のセレクタ（2025年対応）
 */
export const LOGIN_SELECTORS = {
  loginButton: '[data-testid="loginButton"]',
  signupButton: '[data-testid="signupButton"]',
  loginLink: 'a[href="/login"]',
  loginTextJa: 'text="ログイン"',
  loginTextEn: 'text="Sign in"',
  // 新しいパターン
  authFlow: '[data-testid="auth-flow"]',
  loginPrompt: '[role="dialog"]'
} as const;

/**
 * ツイート関連のセレクタ（2025年対応 - 複数パターン）
 */
export const TWEET_SELECTORS = {
  // 従来のセレクター
  tweetContainer: '[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  timestamp: 'time',
  authorLink: '[data-testid="User-Name"] a[role="link"]',
  
  // 新しいパターン（2025年対応）
  articleTweet: 'article[data-testid="tweet"]',
  cellInnerDiv: '[data-testid="cellInnerDiv"] article',
  roleArticle: 'article[role="article"]',
  langDiv: 'div[lang]',
  langSpan: 'span[lang]',
  
  // エンゲージメント（複数パターン）
  likeButton: '[data-testid="like"] span, [data-testid="favorite"] span',
  retweetButton: '[data-testid="retweet"] span, [data-testid="unretweet"] span',
  replyButton: '[data-testid="reply"] span',
  
  // コンテキスト
  socialContext: '[data-testid="socialContext"]',
  socialContextLink: '[data-testid="socialContext"] a',
  
  // 作者情報の新パターン
  userNameNew: '[data-testid="User-Names"] [dir="ltr"]',
  userLinkNew: 'a[href^="/"][role="link"]'
} as const;

/**
 * プロフィール関連のセレクタ（安定版）
 */
export const PROFILE_SELECTORS = {
  userName: '[data-testid="UserName"] span',
  userHandle: '[data-testid="UserName"] [dir="ltr"]',
  userBio: '[data-testid="UserDescription"]',
  followingLink: 'a[href$="/following"] span',
  followersLink: 'a[href$="/verified_followers"] span, a[href$="/followers"] span',
  verifiedIcon: '[data-testid="icon-verified"]',
  
  // 新しいパターン
  profileHeader: '[data-testid="UserProfileHeader"]',
  userAvatar: '[data-testid="UserAvatar"]'
} as const;

/**
 * ツイート抽出用の優先順位付きセレクター配列
 */
export const TWEET_CONTAINER_SELECTORS = [
  '[data-testid="tweet"]',
  'article[data-testid="tweet"]',
  '[data-testid="cellInnerDiv"] article',
  'article[role="article"]',
  'div[data-testid="tweet"]'
] as const;

/**
 * ツイートテキスト抽出用セレクター配列
 */
export const TWEET_TEXT_SELECTORS = [
  '[data-testid="tweetText"]',
  '[lang] span',
  'div[lang]',
  'span[lang]',
  '[dir="auto"]'
] as const;

/**
 * 作者抽出用セレクター配列
 */
export const AUTHOR_SELECTORS = [
  '[data-testid="User-Name"] a[role="link"]',
  '[data-testid="User-Names"] a[role="link"]',
  'a[href^="/"][role="link"]',
  '[href^="/"][role="link"]'
] as const;

/**
 * セレクタの配列版（複数チェック用）
 */
export const LOGIN_SELECTORS_ARRAY = Object.values(LOGIN_SELECTORS);

/**
 * 数値の抽出（K, M表記も考慮） - 改良版
 */
export function parseEngagement(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  
  // 数字以外の文字を除去してマッチング
  const cleanText = text.replace(/[^\d.,KMBkmb]/gi, '');
  const match = cleanText.match(/([\d,]+\.?\d*)\s*([KMBkmb]?)/i);
  
  if (!match) {
    // フォールバック: 単純な数字抽出
    const numMatch = text.match(/\d+/);
    return numMatch ? parseInt(numMatch[0]) : 0;
  }
  
  let num = parseFloat(match[1].replace(/,/g, ''));
  const suffix = match[2].toUpperCase();
  
  if (suffix === 'K') num *= 1000;
  else if (suffix === 'M') num *= 1000000;
  else if (suffix === 'B') num *= 1000000000;
  
  return Math.floor(num);
}

/**
 * テキストコンテンツの安全な取得
 */
export function getTextContent(element: Element | null, selector?: string): string {
  const targetElement = selector ? element?.querySelector(selector) : element;
  return targetElement?.textContent?.trim() || '';
}

/**
 * 属性値の安全な取得
 */
export function getAttribute(element: Element | null, attribute: string): string {
  return element?.getAttribute(attribute) || '';
}

/**
 * 複数セレクターでの要素検索
 */
export function findElementBySelectors(
  container: Element | Document, 
  selectors: readonly string[]
): Element | null {
  for (const selector of selectors) {
    const element = container.querySelector(selector);
    if (element) return element;
  }
  return null;
}

/**
 * 複数セレクターでの全要素検索
 */
export function findAllElementsBySelectors(
  container: Element | Document, 
  selectors: readonly string[]
): Element[] {
  for (const selector of selectors) {
    const elements = Array.from(container.querySelectorAll(selector));
    if (elements.length > 0) return elements;
  }
  return [];
}

/**
 * DOM構造デバッグ用ヘルパー
 */
export function debugDOMStructure(): {
  tweetContainers: Array<{selector: string, count: number}>,
  textElements: Array<{selector: string, count: number}>,
  timeElements: Array<{selector: string, count: number}>
} {
  const debug = {
    tweetContainers: [] as Array<{selector: string, count: number}>,
    textElements: [] as Array<{selector: string, count: number}>,
    timeElements: [] as Array<{selector: string, count: number}>
  };
  
  // ツイートコンテナのチェック
  TWEET_CONTAINER_SELECTORS.forEach(selector => {
    const count = document.querySelectorAll(selector).length;
    debug.tweetContainers.push({ selector, count });
  });
  
  // テキスト要素のチェック
  TWEET_TEXT_SELECTORS.forEach(selector => {
    const count = document.querySelectorAll(selector).length;
    debug.textElements.push({ selector, count });
  });
  
  // 時刻要素のチェック
  const timeSelectors = ['time', '[datetime]', '[aria-label*="時"]'];
  timeSelectors.forEach(selector => {
    const count = document.querySelectorAll(selector).length;
    debug.timeElements.push({ selector, count });
  });
  
  return debug;
}