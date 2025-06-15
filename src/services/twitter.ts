// src/services/twitter.ts
// X(Twitter)操作の専用サービス - 2025年最新DOM構造対応版

import { Page } from 'puppeteer';
import { Tweet, UserProfile, MCPResponse, CollectionConfig, SearchConfig } from '../types/interfaces.js';
import { humanDelay, humanMouseMove, humanScroll } from '../utils/human-behavior.js';
import { 
  LOGIN_SELECTORS_ARRAY, 
  TWEET_SELECTORS, 
  PROFILE_SELECTORS,
  parseEngagement,
  getTextContent,
  getAttribute 
} from '../utils/selectors.js';

export class TwitterService {
  constructor(private page: Page) {}

  /**
   * 指定ユーザーのページに移動
   */
  async navigateToUser(username: string): Promise<MCPResponse> {
    console.log(`🌐 ${username}のページに移動中...`);
    
    await humanDelay(1000, 2000);
    await this.page.goto(`https://x.com/${username}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await humanDelay(2000, 4000);

    return {
      content: [{
        type: "text",
        text: `📱 @${username} のページに移動しました。ログイン状態を確認してください。`
      }]
    };
  }

  /**
   * ログイン状態をチェック
   */
  async checkLoginStatus(): Promise<MCPResponse> {
    let needsLogin = false;
    
    for (const selector of LOGIN_SELECTORS_ARRAY) {
      const element = await this.page.$(selector);
      if (element) {
        needsLogin = true;
        break;
      }
    }

    if (needsLogin) {
      return {
        content: [{
          type: "text",
          text: "🔐 ログインが必要です。pause_for_human_interactionツールを使用して手動ログインを待機してください。"
        }]
      };
    } else {
      return {
        content: [{
          type: "text",
          text: "✅ ログイン済みです。データ収集を開始できます。"
        }]
      };
    }
  }

  /**
   * キーワード検索
   */
  async searchTweets(config: SearchConfig): Promise<MCPResponse> {
    const { query, maxResults = 10 } = config;
    
    // 検索ページに移動
    await this.page.goto(`https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`);
    await humanDelay(3000, 5000);

    // ツイート収集
    const result = await this.collectTweetsNaturally({ maxTweets: maxResults, scrollDelay: 2000, readingTime: 1500 });
    
    return {
      content: [{
        type: "text",
        text: `🔍 「${query}」の検索結果: ${result.content[0].text}`
      }]
    };
  }

  /**
   * 人間らしいスクロールでツイートを収集
   */
  async collectTweetsNaturally(config: CollectionConfig = {}): Promise<MCPResponse> {
    const { maxTweets = 20, scrollDelay = 3000, readingTime = 2000 } = config;
    
    console.log("🤖 自動操作を開始します。人間によるカーソル操作はブロックされます。");

    const tweets: Tweet[] = [];
    let scrollCount = 0;
    const maxScrolls = Math.ceil(maxTweets / 3); // 1スクロールで約3ツイート取得想定

    try {
      for (let i = 0; i < maxScrolls && tweets.length < maxTweets; i++) {
        console.log(`📜 スクロール ${i + 1}/${maxScrolls}`);
        
        // 人間らしいマウス移動とスクロール
        await humanMouseMove(this.page);
        await humanScroll(this.page);
        
        // 読んでいる風の待機
        await humanDelay(readingTime, readingTime + 1000);
        
        // ツイート情報を取得
        const pageTweets = await this.extractTweets();
        
        // 新しいツイートのみ追加
        for (const tweet of pageTweets) {
          if (!tweets.find(t => t.id === tweet.id) && tweets.length < maxTweets) {
            tweets.push(tweet);
          }
        }
        
        // 次のスクロールまでの待機
        if (i < maxScrolls - 1) {
          await humanDelay(scrollDelay, scrollDelay + 1000);
        }
        
        scrollCount++;
      }

      console.log("✋ 自動操作が完了しました。カーソル操作権が戻りました。");

      return {
        content: [{
          type: "text",
          text: `📊 ${tweets.length}件のツイートを収集しました（${scrollCount}回スクロール）\n\n` +
              tweets.slice(0, 5).map((tweet, index) => 
                `${index + 1}. [@${tweet.author}] ${tweet.text.substring(0, 80)}...\n` +
                `   👍 ${tweet.likes} 🔄 ${tweet.retweets} 💬 ${tweet.replies} | ${tweet.timestamp}`
              ).join('\n\n') +
              `\n\n💡 export_tweets_to_sheets でスプレッドシートに出力できます`
        }]
      };
    } catch (error) {
      throw new Error(`ツイート収集に失敗しました: ${error}`);
    }
  }

  /**
   * ユーザープロフィール情報を取得
   */
  async getUserProfile(): Promise<MCPResponse> {
    const profile = await this.page.evaluate(() => {
      const getTextContent = (selector: string): string => {
        const element = document.querySelector(selector);
        return element?.textContent?.trim() || '';
      };

      const getNumber = (text: string): number => {
        const match = text.match(/[\d,]+/);
        return match ? parseInt(match[0].replace(/,/g, '')) : 0;
      };

      // プロフィール情報を取得
      const displayName = getTextContent('[data-testid="UserName"] span');
      const username = getTextContent('[data-testid="UserName"] [dir="ltr"]')?.replace('@', '');
      const bio = getTextContent('[data-testid="UserDescription"]');
      
      // フォロワー等の数値情報
      const followingElement = document.querySelector('a[href$="/following"] span');
      const followersElement = document.querySelector('a[href$="/verified_followers"] span, a[href$="/followers"] span');
      
      const following = followingElement ? getNumber(followingElement.textContent || '') : 0;
      const followers = followersElement ? getNumber(followersElement.textContent || '') : 0;

      return {
        username: username || '',
        displayName: displayName || '',
        bio: bio || '',
        followers: followers,
        following: following,
        verified: !!document.querySelector('[data-testid="icon-verified"]'),
        tweets: 0
      };
    });

    return {
      content: [{
        type: "text",
        text: `👤 ユーザープロフィール情報\n\n` +
              `名前: ${profile.displayName}\n` +
              `ユーザー名: @${profile.username}\n` +
              `認証済み: ${profile.verified ? '✅' : '❌'}\n` +
              `フォロワー: ${profile.followers.toLocaleString()}人\n` +
              `フォロー中: ${profile.following.toLocaleString()}人\n` +
              `自己紹介: ${profile.bio}\n\n` +
              `💡 export_profile_to_sheets でスプレッドシートに出力できます`
      }]
    };
  }

  /**
   * ページからツイートを抽出 - 2025年最新版
   */
  private async extractTweets(): Promise<Tweet[]> {
    return this.page.evaluate(() => {
      console.log('🔍 ツイート抽出開始...');

      // 🔧 修正: 複数のセレクターパターンを試行
      const possibleSelectors = [
        '[data-testid="tweet"]',
        'article[data-testid="tweet"]',
        '[data-testid="cellInnerDiv"] article',
        'article[role="article"]',
        'div[data-testid="tweet"]',
        '[data-testid="tweetText"]' // テキストから逆算
      ];

      let tweetElements: NodeListOf<Element> | null = null;
      let workingSelector = '';
      
      // 各セレクターを順番に試す
      for (const selector of possibleSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`✅ 使用可能セレクター: ${selector} (${elements.length}個の要素)`);
          tweetElements = elements;
          workingSelector = selector;
          break;
        } else {
          console.log(`❌ セレクター失敗: ${selector}`);
        }
      }

      if (!tweetElements || tweetElements.length === 0) {
        console.log(`❌ 全セレクターでツイート要素が見つかりません。フォールバック抽出を試行...`);
        
        // 🆕 フォールバック: テキストベース抽出
        const allElements = Array.from(document.querySelectorAll('*'));
        const tweetCandidates: Element[] = [];
        
        allElements.forEach(el => {
          const text = el.textContent || '';
          
          // ツイートらしい特徴を持つ要素を探す
          if (text.length > 20 && text.length < 1000 && 
              !el.querySelector('input') && 
              !el.querySelector('button') &&
              (text.includes('@') || text.match(/\d+[hms]|時間前|分前|時|分/))) {
            tweetCandidates.push(el);
          }
        });
        
        console.log(`🔄 フォールバック抽出: ${tweetCandidates.length}個の候補を発見`);
        
        if (tweetCandidates.length > 0) {
          tweetElements = tweetCandidates.slice(0, 10) as any; // 最大10個
          workingSelector = 'フォールバック抽出';
        } else {
          console.log(`❌ フォールバック抽出も失敗。ツイートが存在しないかページ構造が大幅変更されています。`);
          return [];
        }
      }

      const tweets: Array<{
        id: string;
        text: string;
        timestamp: string;
        author: string;
        likes: number;
        retweets: number;
        replies: number;
        isRetweet: boolean;
        originalAuthor?: string;
      }> = [];

      console.log(`📊 ${tweetElements?.length || 0}個の要素を処理中... (セレクター: ${workingSelector})`);

      tweetElements?.forEach((element: Element, index: number) => {
        try {
          // 🔧 修正: より柔軟なテキスト抽出
          const extractTweetText = (el: Element): string => {
            // 複数のパターンでテキストを探す
            const textSelectors = [
              '[data-testid="tweetText"]',
              '[lang] span',
              'div[lang]',
              'span[lang]',
              '[dir="auto"]'
            ];
            
            for (const selector of textSelectors) {
              const textEl = el.querySelector(selector);
              if (textEl?.textContent?.trim()) {
                return textEl.textContent.trim();
              }
            }
            
            // フォールバック: 要素全体のテキスト
            const fullText = el.textContent?.trim() || '';
            
            // 長すぎるテキストは先頭部分のみ取得
            if (fullText.length > 500) {
              return fullText.substring(0, 280) + '...';
            }
            
            return fullText;
          };

          // 🔧 修正: より柔軟な時刻抽出
          const extractTimestamp = (el: Element): string => {
            const timeEl = el.querySelector('time');
            if (timeEl) {
              return timeEl.getAttribute('datetime') || timeEl.textContent || '';
            }
            
            // フォールバック: 相対時間を探す
            const text = el.textContent || '';
            const relativeTime = text.match(/(\d+[hms]|\d+時間前|\d+分前|\d+時|\d+分)/);
            return relativeTime ? relativeTime[0] : new Date().toISOString();
          };

          // 🔧 修正: より柔軟な作者抽出
          const extractAuthor = (el: Element): string => {
            const authorSelectors = [
              '[data-testid="User-Name"] a[role="link"]',
              '[data-testid="User-Names"] a[role="link"]',
              'a[href^="/"]',
              '[href^="/"][role="link"]'
            ];
            
            for (const selector of authorSelectors) {
              const authorEl = el.querySelector(selector);
              if (authorEl) {
                const href = authorEl.getAttribute('href');
                if (href && href.startsWith('/') && !href.includes('/status/')) {
                  return href.slice(1); // "/" を除去
                }
              }
            }
            
            // フォールバック: @ユーザー名を探す
            const text = el.textContent || '';
            const userMatch = text.match(/@([a-zA-Z0-9_]+)/);
            return userMatch ? userMatch[1] : `extracted_user_${index}`;
          };

          // 🔧 修正: エンゲージメント数の抽出
          const extractEngagement = (el: Element, type: 'like' | 'retweet' | 'reply'): number => {
            const testIds = {
              like: ['like', 'favorite'],
              retweet: ['retweet', 'unretweet'],
              reply: ['reply']
            };
            
            for (const testId of testIds[type]) {
              const engagementEl = el.querySelector(`[data-testid="${testId}"] span`);
              if (engagementEl?.textContent) {
                const num = parseEngagement(engagementEl.textContent);
                if (num > 0) return num;
              }
            }
            
            // フォールバック: テキストから数字を抽出
            const text = el.textContent || '';
            const numbers = text.match(/\d+/g);
            return numbers ? parseInt(numbers[0]) : 0;
          };

          // parseEngagement関数の定義（ページ内で実行されるため再定義が必要）
          const parseEngagement = (text: string): number => {
            if (!text || typeof text !== 'string') return 0;
            
            const cleanText = text.replace(/[^\d.,KMBkmb]/gi, '');
            const match = cleanText.match(/([\d,]+\.?\d*)\s*([KMBkmb]?)/i);
            
            if (!match) {
              const numMatch = text.match(/\d+/);
              return numMatch ? parseInt(numMatch[0]) : 0;
            }
            
            let num = parseFloat(match[1].replace(/,/g, ''));
            const suffix = match[2].toUpperCase();
            
            if (suffix === 'K') num *= 1000;
            else if (suffix === 'M') num *= 1000000;
            else if (suffix === 'B') num *= 1000000000;
            
            return Math.floor(num);
          };

          const text = extractTweetText(element);
          const timestamp = extractTimestamp(element);
          const author = extractAuthor(element);

          // 空のツイートや短すぎるものは除外
          if (!text || text.length < 5) {
            console.log(`⏭️ ツイート${index + 1}: テキストが短すぎるためスキップ`);
            return;
          }

          const likes = extractEngagement(element, 'like');
          const retweets = extractEngagement(element, 'retweet');
          const replies = extractEngagement(element, 'reply');

          tweets.push({
            id: `tweet_${Date.now()}_${index}`,
            text: text,
            timestamp: timestamp,
            author: author,
            likes: likes,
            retweets: retweets,
            replies: replies,
            isRetweet: !!element.querySelector('[data-testid="socialContext"]'),
            originalAuthor: element.querySelector('[data-testid="socialContext"] a')?.textContent || undefined
          });

          console.log(`✅ ツイート${index + 1}: @${author} - ${text.substring(0, 50)}... (👍${likes} 🔄${retweets} 💬${replies})`);
          
        } catch (error) {
          console.error(`❌ ツイート${index + 1}の抽出エラー:`, error);
        }
      });

      console.log(`📊 抽出完了: ${tweets.length}件のツイートを取得しました`);
      return tweets;
    }) as Promise<Tweet[]>;
  }

  /**
   * 🆕 デバッグ: ページのDOM構造を調査
   */
  async debugPageStructure(): Promise<MCPResponse> {
    const debug = await this.page.evaluate(() => {
      const info = {
        url: window.location.href,
        title: document.title,
        possibleTweetSelectors: [] as string[],
        sampleElements: [] as string[],
        elementCounts: {} as Record<string, number>
      };

      // 可能性のあるツイート要素を調査
      const testSelectors = [
        '[data-testid="tweet"]',
        'article[data-testid="tweet"]',
        '[data-testid="cellInnerDiv"]',
        'article[role="article"]',
        '[data-testid="tweetText"]',
        'div[lang]',
        'span[lang]',
        'time',
        '[datetime]'
      ];

      testSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        const count = elements.length;
        info.elementCounts[selector] = count;
        
        if (count > 0) {
          info.possibleTweetSelectors.push(`${selector}: ${count}個`);
          
          // 最初の要素のサンプルHTML
          if (elements[0]) {
            info.sampleElements.push(
              `${selector}: ${elements[0].outerHTML.substring(0, 200)}...`
            );
          }
        }
      });

      return info;
    });

    return {
      content: [{
        type: "text",
        text: `🔍 ページ構造デバッグ情報\n\n` +
              `URL: ${debug.url}\n` +
              `タイトル: ${debug.title}\n\n` +
              `見つかった要素:\n${debug.possibleTweetSelectors.join('\n')}\n\n` +
              `要素数詳細:\n${Object.entries(debug.elementCounts).map(([sel, count]) => `${sel}: ${count}`).join('\n')}\n\n` +
              `サンプルHTML:\n${debug.sampleElements.join('\n\n')}`
      }]
    };
  }

  /**
   * 最後に収集したツイートを取得
   */
  getLastCollectedTweets(): Tweet[] {
    // 実装は後でデータストレージと統合
    return [];
  }

  /**
   * 最後に取得したプロフィールを取得
   */
  getLastCollectedProfile(): UserProfile | null {
    // 実装は後でデータストレージと統合
    return null;
  }
}