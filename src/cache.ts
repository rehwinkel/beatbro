import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

class OggCache {
    base: string;

    constructor(base: string) {
        this.base = base;
    }

    getPath(hash: string, ending: string): string {
        const directory = join(this.base, hash.substring(0, 2));
        return join(directory, hash + "." + ending);
    }

    createEntry(hash: string, ending: string): string {
        const directory = join(this.base, hash.substring(0, 2));
        mkdirSync(directory, { recursive: true });
        return this.getPath(hash, ending);
    }

    getEntry(hash: string, ending: string): string | undefined {
        let path: string = this.getPath(hash, ending);
        if (existsSync(path)) {
            return path;
        }
    }
}

export { OggCache };