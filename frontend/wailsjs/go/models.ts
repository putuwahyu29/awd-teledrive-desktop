export namespace main {
	
	export class CachedChannel {
	    accessHash: number;
	    title: string;
	
	    static createFrom(source: any = {}) {
	        return new CachedChannel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accessHash = source["accessHash"];
	        this.title = source["title"];
	    }
	}
	export class SyncTask {
	    id: string;
	    localPath: string;
	    destChatId: string;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SyncTask(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.localPath = source["localPath"];
	        this.destChatId = source["destChatId"];
	        this.enabled = source["enabled"];
	    }
	}
	export class AppConfig {
	    api_id: string;
	    api_hash: string;
	    autoBackupEnabled: boolean;
	    backupFolder: string;
	    backupDestChatId: string;
	    syncTasks: SyncTask[];
	    syncMode: string;
	    syncInterval: number;
	    channelCache: Record<string, CachedChannel>;
	    minimizeToTray: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.api_id = source["api_id"];
	        this.api_hash = source["api_hash"];
	        this.autoBackupEnabled = source["autoBackupEnabled"];
	        this.backupFolder = source["backupFolder"];
	        this.backupDestChatId = source["backupDestChatId"];
	        this.syncTasks = this.convertValues(source["syncTasks"], SyncTask);
	        this.syncMode = source["syncMode"];
	        this.syncInterval = source["syncInterval"];
	        this.channelCache = this.convertValues(source["channelCache"], CachedChannel, true);
	        this.minimizeToTray = source["minimizeToTray"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class DriveItem {
	    id: string;
	    name: string;
	    type: string;
	    size: number;
	    mimeType: string;
	    parentId: string;
	    date: number;
	
	    static createFrom(source: any = {}) {
	        return new DriveItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.size = source["size"];
	        this.mimeType = source["mimeType"];
	        this.parentId = source["parentId"];
	        this.date = source["date"];
	    }
	}
	export class PageResult {
	    items: DriveItem[];
	    hasMore: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PageResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], DriveItem);
	        this.hasMore = source["hasMore"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RecentItem {
	    file: DriveItem;
	    action: string;
	    time: number;
	
	    static createFrom(source: any = {}) {
	        return new RecentItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.file = this.convertValues(source["file"], DriveItem);
	        this.action = source["action"];
	        this.time = source["time"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class StorageStats {
	    images: number;
	    videos: number;
	    audio: number;
	    documents: number;
	    archives: number;
	    others: number;
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new StorageStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.images = source["images"];
	        this.videos = source["videos"];
	        this.audio = source["audio"];
	        this.documents = source["documents"];
	        this.archives = source["archives"];
	        this.others = source["others"];
	        this.total = source["total"];
	    }
	}
	
	export class TelephotoGroup {
	    id: string;
	    title: string;
	    hasBackup: boolean;
	    accessHash: number;
	
	    static createFrom(source: any = {}) {
	        return new TelephotoGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.hasBackup = source["hasBackup"];
	        this.accessHash = source["accessHash"];
	    }
	}
	export class TelephotoMediaItem {
	    localId: number;
	    localUri: string;
	    telegramFileId: string;
	    telegramMessageId: number;
	    syncStatus: string;
	    timestamp: number;
	    mimeType: string;
	    size: number;
	    name: string;
	    isVideo: boolean;
	    isFavorite: boolean;
	    isEncrypted: boolean;
	    latitude: number;
	    longitude: number;
	    bucketName: string;
	    cameraModel: string;
	    resolution: string;
	
	    static createFrom(source: any = {}) {
	        return new TelephotoMediaItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.localId = source["localId"];
	        this.localUri = source["localUri"];
	        this.telegramFileId = source["telegramFileId"];
	        this.telegramMessageId = source["telegramMessageId"];
	        this.syncStatus = source["syncStatus"];
	        this.timestamp = source["timestamp"];
	        this.mimeType = source["mimeType"];
	        this.size = source["size"];
	        this.name = source["name"];
	        this.isVideo = source["isVideo"];
	        this.isFavorite = source["isFavorite"];
	        this.isEncrypted = source["isEncrypted"];
	        this.latitude = source["latitude"];
	        this.longitude = source["longitude"];
	        this.bucketName = source["bucketName"];
	        this.cameraModel = source["cameraModel"];
	        this.resolution = source["resolution"];
	    }
	}
	export class WebShareItem {
	    id: string;
	    name: string;
	    type: string;
	    telegramId: string;
	    parentId: string;
	    size: number;
	    mimeType: string;
	    date: number;
	    password: string;
	    accessCount: number;
	
	    static createFrom(source: any = {}) {
	        return new WebShareItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.telegramId = source["telegramId"];
	        this.parentId = source["parentId"];
	        this.size = source["size"];
	        this.mimeType = source["mimeType"];
	        this.date = source["date"];
	        this.password = source["password"];
	        this.accessCount = source["accessCount"];
	    }
	}

}

