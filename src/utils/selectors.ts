// src/utils/selectors.ts
// X(Twitter)のDOMセレクタを一元管理

/**
 * ログイン関連のセレクタ
 */
export const LOGIN_SELECTORS = {
    loginButton: '[data-testid="loginButton"]',
    signupButton: '[data-testid="signupButton"]',
    loginLink: 'a[href="/login"]',
    loginTextJa: 'text="ログイン"',
    loginTextEn: 'text="Sign in"'
  } as const;
  
  /**
   * ツイート関連のセレクタ
   */
  export const TWEET_SELECTORS = {
    tweetContainer: '[data-testid="tweet"]',
    tweetText: '[data-testid="tweetText"]',
    timestamp: 'time',
    authorLink: '[data-testid="User-Name"] a[role="link"]',
    likeButton: '[data-testid="like"] span',
    retweetButton: '[data-testid="retweet"] span',
    replyButton: '[data-testid="reply"] span',
    socialContext: '[data-testid="socialContext"]',
    socialContextLink: '[data-testid="socialContext"] a'
  } as const;
  
  /**
   * プロフィール関連のセレクタ
   */
  export const PROFILE_SELECTORS = {
    userName: '[data-testid="UserName"] span',
    userHandle: '[data-testid="UserName"] [dir="ltr"]',
    userBio: '[data-testid="UserDescription"]',
    followingLink: 'a[href$="/following"] span',
    followersLink: 'a[href$="/verified_followers"] span, a[href$="/followers"] span',
    verifiedIcon: '[data-testid="icon-verified"]'
  } as const;
  
  /**
   * セレクタの配列版（複数チェック用）
   */
  export const LOGIN_SELECTORS_ARRAY = Object.values(LOGIN_SELECTORS);
  
  /**
   * 数値の抽出（K, M表記も考慮）
   */
  export function parseEngagement(text: string): number {
    if (!text) return 0;
    
    const match = text.match(/([\d,]+\.?\d*)\s*([KMB]?)/i);
    if (!match) return 0;
    
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