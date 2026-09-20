declare module '*.css';
declare module '*.svg' { const url: string; export default url; }
declare const FONT_LICENSES: string;

declare const HOSTED_OFFLINE_ENABLED: boolean;

declare module '*.txt' { const text: string; export default text; }
