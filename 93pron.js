/**
 * XPTV VOD Script - 91Porn Support
 * 实现功能: 抓取91Porn网站的指定分类视频列表和搜索结果，返回JSON数据
 * 作者: （你的名字或ID）
 * 日期: 2025-03-12
 */

// ========== 配置部分 ==========

// 91Porn 当前可访问的基础域名或URL前缀（根据需要更换为有效的镜像域名）
const BASE_URL = "https://91porn.com";  // 可以替换为当前有效的91Porn域名，如 https://p06.rocks 等

// HTTP 请求使用的头信息，设置User-Agent和语言Cookie
const HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/108.0.0.0 Safari/537.36",
    "Cookie": "language=cn_CN"  // 确保获取中文内容
};

// 定义分类映射：type_id 对应查询参数（根据91Porn的category参数）
const CATEGORY_MAP = {
    "1": "rf",   // 最近更新 (rf = recent updates)
    "2": "hot",  // 当前最热 (hot = current hot videos)
    "3": "top",  // 本月最热 (top = hottest of this month)
    "4": "top",  // 每月最热 (暂用同"top"，表示总热门或历史热门)
    "5": "mf"    // 本月收藏 (mf = most favorites of this month)
};

// ========== 工具函数部分 ==========

/**
 * 发送HTTP GET请求并获取文本内容
 * @param {string} url 完整请求URL
 * @returns {string} 返回响应的HTML文本
 */
function httpGet(url) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);  // 同步请求
    // 设置请求头
    for (const header in HTTP_HEADERS) {
        xhr.setRequestHeader(header, HTTP_HEADERS[header]);
    }
    xhr.send();
    if (xhr.status === 200) {
        return xhr.responseText;
    } else {
        // 请求失败时返回空字符串
        return "";
    }
}

/**
 * 解析视频列表HTML，提取视频条目信息
 * @param {string} html 列表页的HTML文本
 * @returns {Array} 视频信息对象数组，每个对象包含 vod_id, vod_name, vod_pic, vod_remarks
 */
function parseVideoList(html) {
    const list = [];
    if (!html) {
        return list;
    }
    // 使用正则匹配每个视频条目区域
    // 91Porn列表每个视频项包含缩略图<img>以及<a>链接等，我们根据已知结构提取
    const itemRegex = /<div class="listchannel".*?<\/div>\s*<\/div>/g;  // 每个视频项的块（粗略匹配到外层结束）
    const items = html.match(itemRegex);
    if (!items) {
        return list;
    }
    for (const itemHtml of items) {
        // 提取视频页面链接和标题：缩略图<img>的title属性即视频标题，父链接href为视频详情页
        const titleMatch = itemHtml.match(/<img[^>]*?title="([^"]+)"[^>]*>/);
        const linkMatch = itemHtml.match(/<a[^>]*?href="([^"]*view_video[^"]+)"[^>]*>/);
        const imgMatch  = itemHtml.match(/<img[^>]*?src="([^"]+)"[^>]*>/);
        if (!titleMatch || !linkMatch) {
            continue;  // 跳过无法解析的项
        }
        const title = titleMatch[1].trim();
        const videoPageUrl = linkMatch[1].trim();
        const pic = imgMatch ? imgMatch[1].trim() : "";  // 缩略图URL，可能存在于<img>的src属性
        // 提取时长作为备注（如果存在）：在 itemHtml 中查找时长信息
        let remark = "";
        const durationMatch = itemHtml.match(/<span class="info">时长:<\/span>\s*([^<]+)/);
        if (durationMatch) {
            remark = durationMatch[1].trim();  // 如 "05:32"
        } else {
            // 如果没找到时长，用查看次数或其他信息作为备注
            const viewsMatch = itemHtml.match(/<span class="info">查看:<\/span>\s*([^<]+)/);
            if (viewsMatch) {
                remark = "热度:" + viewsMatch[1].trim();  // e.g. "热度:12345"
            }
        }
        // 构造视频对象，vod_id 使用详情页链接（在播放时可用此链接获取视频）
        list.push({
            vod_id: videoPageUrl,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: remark
        });
    }
    return list;
}

/**
 * 解析搜索结果HTML，提取视频列表
 * （搜索结果页面结构与普通列表相似，可复用 parseVideoList）
 */
function parseSearchList(html) {
    return parseVideoList(html);
}

// ========== 核心处理部分 ==========

/**
 * 获取指定分类页面的第$page页视频列表
 * @param {string} category 分类代码（CATEGORY_MAP的值，如 "rf","hot","top","mf"）
 * @param {number} page 页码，从1开始
 * @returns {Array} 视频列表数组
 */
function fetchCategoryList(category, page) {
    const url = `${BASE_URL}/v.php?category=${category}&viewtype=basic&page=${page}`;
    const html = httpGet(url);
    return parseVideoList(html);
}

/**
 * 根据关键词搜索视频
 * @param {string} keyword 搜索关键词
 * @param {number} page 页码，从1开始（91Porn搜索结果通常在单页显示）
 * @returns {Array} 视频列表数组
 */
function fetchSearchList(keyword, page) {
    // 构造搜索URL。91Porn 的搜索可能通过 search_result.php 页面
    const searchUrl = `${BASE_URL}/search_result.php?search_type=search_videos&keyword=${encodeURIComponent(keyword)}&page=${page}`;
    const html = httpGet(searchUrl);
    return parseSearchList(html);
}

// ========== 主流程 ==========

// 模拟读取传入的参数（XPTV 平台应当提供当前请求的类型或关键字等参数给脚本）
// 这里假定存在全局变量 input 或类似结构指示请求类型：例如 input.type 区分分类或搜索，input.page指页码等。
var inputType = typeof(input) !== "undefined" ? input.type : "category";  // "category" 或 "search"
var inputId   = typeof(input) !== "undefined" ? input.id : "1";          // 请求的分类ID（字符串形式）或搜索关键字
var pageNo    = typeof(input) !== "undefined" ? (input.page || 1) : 1;   // 页码，默认为1

// 输出结果的对象
var result = {
    class: [],   // 分类列表
    list: [],    // 视频条目列表
    page: pageNo,
    pagecount: 1,
    limit: 20,
    total: 0
};

// 定义五个分类（type_id 为数字字符串，type_name 为显示名称）
result.class = [
    { type_id: "1", type_name: "最近更新" },
    { type_id: "2", type_name: "当前最热" },
    { type_id: "3", type_name: "本月最热" },
    { type_id: "4", type_name: "每月最热" },
    { type_id: "5", type_name: "本月收藏" }
];

// 根据请求类型获取相应数据
if (inputType === "search") {
    // 搜索请求
    const keyword = inputId;  // 此时的 inputId 实际上是搜索关键字
    result.list = fetchSearchList(keyword, pageNo);
    // 搜索结果通常没有多页（或未知），这里将总数简单设置为当前列表长度
    result.total = result.list.length;
    result.pagecount = 1;
} else {
    // 分类列表请求
    const typeId = inputId;  // 请求的分类ID (字符串形式, "1"-"5")
    // 获取对应分类代码
    const categoryCode = CATEGORY_MAP[typeId] || "rf";
    // 抓取该分类指定页的列表
    const videoList = fetchCategoryList(categoryCode, pageNo);
    result.list = videoList;
    // 简单估计分页信息（91Porn未提供总数，这里假设每页20条，并通过是否满20判断是否有下一页）
    result.limit = 20;
    result.total = videoList.length + (videoList.length === 20 ? 20 : 0);  // 粗略估计，如满20则假设至少还有一页
    result.pagecount = (videoList.length === 20) ? pageNo + 1 : pageNo;
}

// 将结果转换为 JSON 字符串输出
JSON.stringify(result);
