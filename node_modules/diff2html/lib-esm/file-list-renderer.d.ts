import HoganJsUtils from './hoganjs-utils';
import { ColorSchemeType, DiffFile } from './types';
export interface FileListRendererConfig {
    colorScheme?: ColorSchemeType;
}
export declare const defaultFileListRendererConfig: {
    colorScheme: ColorSchemeType;
};
export declare class FileListRenderer {
    private readonly hoganUtils;
    private readonly config;
    constructor(hoganUtils: HoganJsUtils, config?: FileListRendererConfig);
    render(diffFiles: DiffFile[]): string;
}
//# sourceMappingURL=file-list-renderer.d.ts.map