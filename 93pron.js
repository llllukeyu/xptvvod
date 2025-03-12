/**
 * 91porn VOD 脚本（供 xptv 使用）
 * 站点: https://www.91porn.com
 */

const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) ' +
           'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 ' +
           'Mobile/15E148 Safari/604.1';

let appConfig = {
    ver: 1,
    title: '91porn',
    site: 'https://www.91porn.com'
};

/**
 * 获取配置
 */
async function getConfig() {
    let config = {
        ver: appConfig.ver,
        title: appConfig.title,
        site: appConfig.site,
        // 这里定义首页、热门、最新等标签，ext.type 用于后续在 getCards 中区分不同列表
        tabs: [
            { name: '首页', ext: { type: 'index' } },
            { name: '热门', ext: { type: 'hot' } },
            { name: '最新', ext: { type: 'latest' } },
        ]
    };
    return jsonify(config);
}

/**
 * 获取视频列表（卡片）
 * ext 中应包含 page 与 type 两个字段，type 对应上面 tabs 定义的 ext.type
 */
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, type = 'index' } = ext;
    let url = '';

    // 根据不同类型构造 URL（此处 URL 格式需要根据91porn实际情况调整）
    if (type === 'index') {
        url = appConfig.site + '/index.php';
    } else if (type === 'hot') {
        url = appConfig.site + '/hot.php';
    } else if (type === 'latest') {
        url = appConfig.site + '/new.php';
    } else {
        url = appConfig.site + '/index.php';
    }
    // 如果有分页，追加 page 参数（实际结构可能不同）
    if (page > 1) {
        url += '?page=' + page;
    }

    const { data } = await $fetch.get(url, {
        headers: { 'User-Agent': UA }
    });
    const $ = cheerio.load(data);

    // 假设视频列表在 ul.video-list 内，每个视频在 li 内
    $('ul.video-list li').each((i, element) => {
        let a = $(element).find('a');
        let href = a.attr('href');
        let title = a.attr('title') || a.text().trim();
        // 尝试获取封面图片（注意部分图片可能使用 lazyload）
        let cover = $(element).find('img').attr('data-original') ||
                    $(element).find('img').attr('src');
        // 例如视频时长或其它说明
        let remarks = $(element).find('.duration').text().trim();
        if (href) {
            cards.push({
                vod_id: href,
                vod_name: title,
                vod_pic: cover,
                vod_remarks: remarks,
                ext: { url: appConfig.site + href }
            });
        }
    });
    return jsonify({ list: cards });
}

/**
 * 获取播放列表（分组）
 * 从视频详情页中解析出播放地址
 */
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url;

    const { data } = await $fetch.get(url, {
        headers: { 'User-Agent': UA }
    });

    // 尝试解析页面中定义的播放地址，例如：
    //   var hlsUrl = "http://xxx.m3u8";
    let match = data.match(/var\s+hlsUrl\s*=\s*"(.*?)"/);
    if (match && match[1]) {
        let playUrl = match[1];
        tracks.push({
            name: '播放',
            pan: '',
            ext: { url: playUrl }
        });
    } else {
        // 如果没有匹配到 hlsUrl，可尝试其它正则（根据实际页面结构调整）
        let m = data.match(/"url"\s*:\s*"(http.*?)"/);
        if (m && m[1]) {
            tracks.push({
                name: '播放',
                pan: '',
                ext: { url: m[1] }
            });
        }
    }
    return jsonify({
        list: [{
            title: '默认分组',
            tracks: tracks
        }]
    });
}

/**
 * 获取播放信息
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    let url = ext.url;
    return jsonify({
        urls: [url],
        headers: [{ 'User-Agent': UA, Referer: appConfig.site }]
    });
}

/**
 * 搜索功能
 */
async function search(ext) {
    ext = argsify(ext);
    let cards = [];
    let text = encodeURIComponent(ext.text);
    let page = ext.page || 1;
    // 构造搜索 URL（实际参数名称与路径可能与此不同，请参考 91porn 的搜索接口）
    let url = appConfig.site + '/index.php?search=' + text;
    if (page > 1) {
        url += '&page=' + page;
    }
    const { data } = await $fetch.get(url, {
        headers: { 'User-Agent': UA }
    });
    const $ = cheerio.load(data);

    // 与 getCards 类似，解析搜索结果
    $('ul.video-list li').each((i, element) => {
        let a = $(element).find('a');
        let href = a.attr('href');
        let title = a.attr('title') || a.text().trim();
        let cover = $(element).find('img').attr('data-original') ||
                    $(element).find('img').attr('src');
        let remarks = $(element).find('.duration').text().trim();
        if (href) {
            cards.push({
                vod_id: href,
                vod_name: title,
                vod_pic: cover,
                vod_remarks: remarks,
                ext: { url: appConfig.site + href }
            });
        }
    });
    return jsonify({ list: cards });
}
