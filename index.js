/**
 * fis3 parser babel7
 * @file fis3 babel7 parser 模块
 */

'use strict';

var path = require('path');
var fs = require('fs');
var qrequire = require('qrequire');
var json5 = require('json5');
var parser = require('@babel/core');
var speeded = false;

/**
 * 读取 babel 配置
 *
 * @return {?Object}
 */
function readBabelConfig() {
    var _ = fis.util;
    var currDir = process.cwd();
    var babelRcFile = path.resolve(currDir, '.babelrc');
    if (_.isFile(babelRcFile)) {
        return json5.parse(fs.readFileSync(babelRcFile, 'utf-8'));
    }

    var pkgMetaFile = path.resolve(currDir, 'package.json');
    if (_.isFile(pkgMetaFile)) {
        return require(pkgMetaFile).babel;
    }
}

/**
 * 使用 babel6 编译代码文件
 *
 * @param {string} content 代码内容
 * @param {Object} file 文件对象
 * @param {Object} conf 定制配置
 * @return {string}
 */
function compile(content, file, conf) {
    if (file.disableBabel) {
        return content;
    }

    // init options
    var _ = fis.util;
    var options = _.assign({
        filename: file.subpath.replace(/^\/+/, ''), // remove start slash
        sourceFileName: file.subpath
    }, readBabelConfig() || {}, conf);

    // hook require when enable speed
    var useSpeed = options.speed;
    delete options.speed;
    if (useSpeed && !speeded) {
        qrequire.hook();
        speeded = true;
    }
    else {
        useSpeed = false;
    }

    // transform code
    var result = parser.transform(content, options);

    // extract used babel helper api
    if (result.metadata
        && result.metadata.usedHelpers
    ) {
        // cache the used babel helper information
        var usedHelpers = result.metadata.usedHelpers;
        file.extras.babelHelpers = usedHelpers;
    }

    useSpeed || qrequire.unhook();

    // init source map
    var sourceMaps = options.sourceMaps;
    if (sourceMaps && sourceMaps !== 'inline' && result.map) {
        var sourceMapPath = file.realpath + '.map';
        var sourceMapFile = fis.file.wrap(sourceMapPath);
        sourceMapFile.setContent(JSON.stringify(result.map, null, 2));
        file.derived.push(sourceMapFile);

        var sourceMapUrl = sourceMapFile.getUrl(
            fis.compile.settings.hash, fis.compile.settings.domain
        );
        result.code += '\n//# sourceMappingURL=' + sourceMapUrl + '\n';
    }

    return result.code;
}

module.exports = exports = compile;
