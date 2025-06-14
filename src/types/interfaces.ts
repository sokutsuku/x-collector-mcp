// src/types/interfaces.ts
// 全ての型定義を統一管理

export interface Tweet {
    id: string;
    text: string;
    timestamp: string;
    author: string;
    likes: number;
    retweets: number;
    replies: number;
    isRetweet: boolean;
    originalAuthor?: string;
  }
  
  export interface UserProfile {
    username: string;
    displayName: string;
    bio: string;
    followers: number;
    following: number;
    tweets: number;
    verified: boolean;
    profileImageUrl?: string;
  }
  
  export interface SheetData {
    spreadsheetId: string;
    worksheetName: string;
    range: string;
    data: any[][];
  }
  
  export interface SheetInfo {
    spreadsheetId: string;
    title: string;
    url: string;
    worksheets: string[];
  }
  
  export interface ExportResult {
    success: boolean;
    spreadsheetId: string;
    worksheetName: string;
    totalRows: number;
    newRows: number;
    startRow: number;
    url: string;
  }
  
  export interface MCPResponse {
    content: Array<{
      type: "text";
      text: string;
    }>;
  }
  
  export interface BrowserConfig {
    slowMo?: number;
    viewportWidth?: number;
    viewportHeight?: number;
    headless?: boolean;
  }
  
  export interface CollectionConfig {
    maxTweets?: number;
    scrollDelay?: number;
    readingTime?: number;
  }
  
  export interface SearchConfig {
    query: string;
    maxResults?: number;
  }
  
  // Google Sheets関連の型
  export interface SheetsCredentials {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
  }
  
  export interface WorksheetData {
    headers: string[];
    rows: any[][];
  }