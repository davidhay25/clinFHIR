import * as renderUtils from './render-utils';
const baseTemplatesPath = 'file-summary';
const iconsBaseTemplatesPath = 'icon';
export const defaultFileListRendererConfig = {
    colorScheme: renderUtils.defaultRenderConfig.colorScheme,
};
export class FileListRenderer {
    constructor(hoganUtils, config = {}) {
        this.hoganUtils = hoganUtils;
        this.config = Object.assign(Object.assign({}, defaultFileListRendererConfig), config);
    }
    render(diffFiles) {
        const files = diffFiles
            .map(file => this.hoganUtils.render(baseTemplatesPath, 'line', {
            fileHtmlId: renderUtils.getHtmlId(file),
            oldName: file.oldName,
            newName: file.newName,
            fileName: renderUtils.filenameDiff(file),
            deletedLines: '-' + file.deletedLines,
            addedLines: '+' + file.addedLines,
        }, {
            fileIcon: this.hoganUtils.template(iconsBaseTemplatesPath, renderUtils.getFileIcon(file)),
        }))
            .join('\n');
        return this.hoganUtils.render(baseTemplatesPath, 'wrapper', {
            colorScheme: renderUtils.colorSchemeToCss(this.config.colorScheme),
            filesNumber: diffFiles.length,
            files: files,
        });
    }
}
//# sourceMappingURL=file-list-renderer.js.map