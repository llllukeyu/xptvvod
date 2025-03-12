/**
 *  91porn vod 脚本示例
 *
 *  注意：脚本中请勿直接 import axios/cheerio，
 *  在 XPTV 中使用时，需要改为内置的 $fetch / createCheerio()。
 */

// ======== 1. 必须保留的内置对象/方法示例 ===========

// 创建 cheerio
const cheerio = createCheerio()
// 网络请求：在 XPTV 中一般使用 $fetch
// const { data } = await $fetch.get(url, { headers: {} })
// const { data } = await $fetch.post(url, body, { headers: {} })

// 日志打印（可在 http://设备IP:8110/log 查看）
function log(msg) {
  $print('[91porn脚本调试] ' + msg)
}

// 简化序列化、反序列化
function jsonify(obj) {
  return JSON.stringify(obj)
}
function argsify(str) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return {}
  }
}

// =========== 2. 脚本配置信息 ================

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

// 站点配置
let appConfig = {
  ver: 1,            // 脚本内部版本
  title: '91Porn',   // 标题，可自行修改
  site: 'https://www.91porn.com',  // 主站地址
}

/**
 * getConfig：返回整个站点的基本信息，带分类信息
 */
async function getConfig() {
  // 可以在这里做动态分类获取，也可直接返回固定分类
  // 这里示例了常见的几个标签
  let tabs = [
    {
      name: '最新',
      ext: {
        category: 'latest', // category: 自定义字段
        page: 1,
      },
    },
    {
      name: '当前最热',
      ext: {
        category: 'hot',
        page: 1,
      },
    },
    {
      name: '本月最热',
      ext: {
        category: 'top',
        page: 1,
      },
    },
    {
      name: '收藏最多',
      ext: {
        category: 'tf', // tf 代表 top favorite
        page: 1,
      },
    },
  ]

  // 赋值给 appConfig
  appConfig.tabs = tabs
  return jsonify(appConfig)
}

/**
 * getCards：返回某个分类下的视频列表
 * @param {String} ext - 这里包含分类、页码等信息(JSON string)
 */
async function getCards(ext) {
  ext = argsify(ext)
  let { category = 'latest', page = 1 } = ext

  let cards = []

  // 根据 category 构造列表 URL（这里是 91porn 的常见查询参数）
  // 例如：index.php?next=watch&page=1&viewtype=hot
  // 不同分类对应不同 viewtype
  // 这里做了一个简易映射，可以按需自定义
  let viewtype = ''
  switch (category) {
    case 'hot':
      viewtype = 'hot'
      break
    case 'top':
      viewtype = 'top'
      break
    case 'tf':
      viewtype = 'tf'
      break
    default:
      // latest
      viewtype = 'basic'
      break
  }

  // 目标 URL 示例:
  //   https://www.91porn.com/index.php?next=watch&page=2&viewtype=hot
  //   如果页面有其他参数，需要自行组合
  let listUrl = `${appConfig.site}/index.php?next=watch&page=${page}&viewtype=${viewtype}`
  log('getCards -> listUrl: ' + listUrl)

  // 发起请求
  let resp = await $fetch.get(listUrl, {
    headers: {
      'User-Agent': UA,
      Referer: appConfig.site,
    },
  })
  let html = resp.data
  // 使用 Cheerio 解析
  let $ = cheerio.load(html)

  // 根据实际的 91porn 列表结构来查找
  // 常见结构：.row > .col-xs-6.col-sm-4 a.thumbnail
  // 下面仅作示例，需要以真实 DOM 为准
  $('.row .col-xs-6.col-sm-4 .thumbnail').each((i, el) => {
    let aEl = $(el)
    let href = aEl.attr('href') || ''
    let title = aEl.find('img').attr('title') || aEl.find('img').attr('alt') || ''
    let pic = aEl.find('img').attr('src') || ''
    // 有时时长/其他信息可以在 DOM 中找到
    let duration = aEl.find('.duration').text().trim()

    // 构造一个卡片信息
    cards.push({
      vod_id: href,           // 业务 ID
      vod_name: title,        // 标题
      vod_pic: pic,           // 封面
      vod_remarks: duration,  // 备注(时长)
      ext: {
        pageUrl: `${appConfig.site}/${href}`, // 视频详情页面
      },
    })
  })

  // 返回给 XPTV
  return jsonify({
    page: page,
    pagecount: 999,  // 这里不做精确分页，固定一个大值即可
    list: cards,
  })
}

/**
 * getTracks：从视频详情页面中，提取播放资源（一部片子可能只有一个，也可能有多个）
 * @param {String} ext - JSON 字符串，内含上一步传过来的 ext 信息
 */
async function getTracks(ext) {
  ext = argsify(ext)
  let { pageUrl } = ext
  if (!pageUrl) {
    return jsonify({ list: [] })
  }

  let tracks = []
  // 请求详情页
  let resp = await $fetch.get(pageUrl, {
    headers: {
      'User-Agent': UA,
      Referer: appConfig.site,
    },
  })
  let detailHtml = resp.data

  // 解析详情页
  let $ = cheerio.load(detailHtml)
  // 91porn 通常在 JS 变量里存放真实播放链接，需要自行分析
  // 可能出现 var flashvars_ = {... file: "xxx", ...} 或者 hls 之类
  // 简易示例：正则匹配 "flashvars_.file='xxx'":
  let match = detailHtml.match(/flashvars_[^=]*?\.file\s*=\s*['"]([^'"]+)['"]/)
  let realPlayUrl = ''
  if (match && match[1]) {
    realPlayUrl = match[1]
  }

  // 若未匹配到，可以尝试匹配其他格式
  // ...这里仅作示例

  // 构造 tracks
  if (realPlayUrl) {
    tracks.push({
      name: '播放',
      pan: '',
      ext: {
        playUrl: realPlayUrl,
      },
    })
  }

  // 返回多分组示例：这里只有一组
  return jsonify({
    list: [
      {
        title: '默认分组',
        tracks,
      },
    ],
  })
}

/**
 * getPlayinfo：最终解析出可播放的 URL，并可返回自定义 header
 * @param {String} ext - JSON 字符串
 */
async function getPlayinfo(ext) {
  ext = argsify(ext)
  let { playUrl } = ext
  if (!playUrl) {
    // 如果拿不到真实 URL
    return jsonify({ urls: [] })
  }

  // 一般只需把真实的 media URL 返回即可
  // 如果需要自定义请求头，可以在 headers 字段添加
  return jsonify({
    urls: [playUrl],
    headers: [{ 'User-Agent': UA, 'Referer': appConfig.site }],
  })
}

/**
 * search：搜索实现
 * @param {String} ext - XPTV 中，会把搜索关键字放在 ext.text
 */
async function search(ext) {
  ext = argsify(ext)
  let { text = '', page = 1 } = ext
  let cards = []

  if (!text.trim()) {
    return jsonify({ list: [] })
  }

  // 这里基于 91porn 的搜索逻辑构造搜索 URL
  // 若没有公开搜索接口，则需要结合实际情况处理
  // 比如：index.php?keyword=XXXX&searchtype=title
  let searchKey = encodeURIComponent(text)
  let searchUrl = `${appConfig.site}/index.php?searchtype=title&searchrange=on&keyword=${searchKey}&page=${page}`
  log('searchUrl: ' + searchUrl)

  let resp = await $fetch.get(searchUrl, {
    headers: {
      'User-Agent': UA,
      Referer: appConfig.site,
    },
  })
  let html = resp.data
  let $ = cheerio.load(html)

  // 解析搜索结果
  $('.row .col-xs-6.col-sm-4 .thumbnail').each((i, el) => {
    let aEl = $(el)
    let href = aEl.attr('href') || ''
    let title = aEl.find('img').attr('title') || ''
    let pic = aEl.find('img').attr('src') || ''
    let duration = aEl.find('.duration').text().trim()

    cards.push({
      vod_id: href,
      vod_name: title,
      vod_pic: pic,
      vod_remarks: duration,
      ext: {
        pageUrl: `${appConfig.site}/${href}`,
      },
    })
  })

  return jsonify({
    page: page,
    pagecount: 999,
    list: cards,
  })
}
