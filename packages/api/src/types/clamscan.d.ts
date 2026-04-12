declare module 'clamscan' {
  interface ClamScanOptions {
    clamdscan?: {
      host?: string;
      port?: number;
      timeout?: number;
      localFallback?: boolean;
      path?: string;
      configFile?: string;
      multiscan?: boolean;
      reloadDb?: boolean;
      active?: boolean;
      bypassTest?: boolean;
      tls?: boolean;
    };
    preference?: 'clamdscan' | 'clamscan';
    removeInfected?: boolean;
    quarantineInfected?: boolean | string;
    debugMode?: boolean;
    scanRecursively?: boolean;
    fileList?: string;
    scanLog?: string;
  }

  interface ScanResult {
    isInfected: boolean;
    file?: string;
    viruses: string[];
  }

  class NodeClam {
    init(options?: ClamScanOptions): Promise<NodeClam>;
    scanStream(stream: NodeJS.ReadableStream): Promise<ScanResult>;
    scanFile(filePath: string): Promise<ScanResult>;
    scanDir(dirPath: string): Promise<ScanResult>;
    isInfected(filePath: string): Promise<ScanResult>;
    getVersion(): Promise<string>;
  }

  export = NodeClam;
}
