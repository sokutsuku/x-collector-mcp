// src/services/twitter.ts
// X(Twitter)操作の専用サービス

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
   * ページからツイートを抽出
   */
  private async extractTweets(): Promise<Tweet[]> {
    return this.page.evaluate(() => {
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
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

      tweetElements.forEach((element: Element, index: number) => {
        try {
          const textElement = element.querySelector('[data-testid="tweetText"]');
          const timeElement = element.querySelector('time');
          const authorElement = element.querySelector('[data-testid="User-Name"] a[role="link"]');
          
          // エンゲージメント数を取得
          const likeElement = element.querySelector('[data-testid="like"] span');
          const retweetElement = element.querySelector('[data-testid="retweet"] span');
          const replyElement = element.querySelector('[data-testid="reply"] span');

          const text = textElement?.textContent || '';
          const timestamp = timeElement?.getAttribute('datetime') || '';
          const authorHref = authorElement?.getAttribute('href') || '';
          const author = authorHref.replace('/', '').replace('/', '');

          // 数値の抽出（K, M表記も考慮）
          const parseEngagement = (text: string) => {
            if (!text) return 0;
            const match = text.match(/([\d,]+\.?\d*)\s*([KMB]?)/i);
            if (!match) return 0;
            
            let num = parseFloat(match[1].replace(/,/g, ''));
            const suffix = match[2].toUpperCase();
            
            if (suffix === 'K') num *= 1000;
            else if (suffix === 'M') num *= 1000000;
            else if (suffix === 'B') num *= 1000000000;
            
            return Math.floor(num);
          };

          tweets.push({
            id: `tweet_${Date.now()}_${index}`,
            text: text,
            timestamp: timestamp,
            author: author,
            likes: parseEngagement(likeElement?.textContent || '0'),
            retweets: parseEngagement(retweetElement?.textContent || '0'),
            replies: parseEngagement(replyElement?.textContent || '0'),
            isRetweet: !!element.querySelector('[data-testid="socialContext"]'),
            originalAuthor: element.querySelector('[data-testid="socialContext"] a')?.textContent || undefined
          });
        } catch (error) {
          console.error('Tweet extraction error:', error);
        }
      });

      return tweets;
    }) as Promise<Tweet[]>;
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