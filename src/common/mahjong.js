// 杭州麻将游戏引擎 (基于腾讯《麻将来了》杭州麻将规则)
// 136张牌：万/条/筒(1-9各4张) + 东南西北中发白(各4张)
// 核心特色：白板固定为财神（百搭牌），无财神也可胡

// ============ 牌型定义 ============
// code 规则：数字+花色，花色 m=万 s=条 p=筒 z=字
// 字牌：1z东 2z南 3z西 4z北 5z中 6z发 7z白

const HONOR_NAMES = ['', '东', '南', '西', '北', '中', '发', '白']

// 所有牌型code (34种)
function allTileCodes() {
  const codes = []
  for (const s of ['m', 's', 'p']) {
    for (let n = 1; n <= 9; n++) codes.push(n + s)
  }
  for (let n = 1; n <= 7; n++) codes.push(n + 'z')
  return codes
}

// 牌的显示名
function tileName(code) {
  const n = code[0]
  const s = code[1]
  if (s === 'm') return n + '万'
  if (s === 's') return n + '条'
  if (s === 'p') return n + '筒'
  return HONOR_NAMES[parseInt(n, 10)]
}

// 牌颜色
function tileColor(code) {
  const s = code[1]
  if (s === 'm') return '#d23131'
  if (s === 's') return '#1f9d3f'
  if (s === 'p') return '#2563d6'
  const n = parseInt(code[0], 10)
  if (n === 5) return '#d23131' // 中
  if (n === 6) return '#1f9d3f' // 发
  if (n === 7) return '#9a9a9a' // 白
  return '#333333'
}

function isHonor(code) {
  return code[1] === 'z'
}

function tileNum(code) {
  return parseInt(code[0], 10)
}

function tileSuit(code) {
  return code[1]
}

// ============ 牌堆 ============
let tileIdCounter = 0
function createDeck() {
  tileIdCounter = 0
  const deck = []
  for (const code of allTileCodes()) {
    for (let i = 0; i < 4; i++) {
      deck.push({ code, id: tileIdCounter++ })
    }
  }
  return deck
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t
  }
  return arr
}

// 固定财神：白板 (7z) 永远是财神
function determineCaishen() {
  return '7z'
}

// ============ 计数工具 ============
function countCodes(codes) {
  const m = {}
  for (const c of codes) m[c] = (m[c] || 0) + 1
  return m
}

function cloneCounts(m) {
  return Object.assign({}, m)
}

function sortedCodesFromCounts(m) {
  return Object.keys(m).filter(k => m[k] > 0).sort()
}

// ============ 胡牌判定 (含财神百搭) ============
// handCodes: 长度14的code数组 (含财神)
// caishenCode: 财神code
function canWin(handCodes, caishenCode) {
  // 七对子
  if (isSevenPairs(handCodes, caishenCode)) return true
  // 标准胡牌：4组面子 + 1对将
  const counts = {}
  let caishen = 0
  for (const c of handCodes) {
    if (c === caishenCode) caishen++
    else counts[c] = (counts[c] || 0) + 1
  }
  return tryPair(counts, caishen)
}

// 七对子判定
function isSevenPairs(handCodes, caishenCode) {
  if (handCodes.length !== 14) return false
  const counts = {}
  let caishen = 0
  for (const c of handCodes) {
    if (c === caishenCode) caishen++
    else counts[c] = (counts[c] || 0) + 1
  }
  let oddCount = 0
  for (const k in counts) {
    if (counts[k] % 2 === 1) oddCount++
  }
  return caishen >= oddCount && (caishen - oddCount) % 2 === 0
}

// 尝试选将
function tryPair(counts, caishen) {
  const codes = sortedCodesFromCounts(counts)
  // 两张同牌做将
  for (const c of codes) {
    if (counts[c] >= 2) {
      const cc = cloneCounts(counts)
      cc[c] -= 2
      if (tryMelds(cc, caishen)) return true
    }
  }
  // 一张牌 + 一财神做将
  if (caishen >= 1) {
    for (const c of codes) {
      if (counts[c] >= 1) {
        const cc = cloneCounts(counts)
        cc[c] -= 1
        if (tryMelds(cc, caishen - 1)) return true
      }
    }
  }
  // 两财神做将
  if (caishen >= 2) {
    if (tryMelds(cloneCounts(counts), caishen - 2)) return true
  }
  return false
}

// 尝试分解面子 (顺子/刻子)，财神补缺
function tryMelds(counts, caishen) {
  const codes = sortedCodesFromCounts(counts)
  let first = null
  for (const c of codes) {
    if (counts[c] > 0) { first = c; break }
  }
  if (first === null) {
    // 剩余财神需能整组刻子
    return caishen % 3 === 0
  }
  // 刻子
  if (counts[first] >= 3) {
    const cc = cloneCounts(counts)
    cc[first] -= 3
    if (tryMelds(cc, caishen)) return true
  }
  if (counts[first] >= 2 && caishen >= 1) {
    const cc = cloneCounts(counts)
    cc[first] -= 2
    if (tryMelds(cc, caishen - 1)) return true
  }
  if (counts[first] >= 1 && caishen >= 2) {
    const cc = cloneCounts(counts)
    cc[first] -= 1
    if (tryMelds(cc, caishen - 2)) return true
  }
  // 顺子 (仅数牌)
  if (!isHonor(first)) {
    const n = tileNum(first)
    if (n <= 7) {
      const c2 = (n + 1) + tileSuit(first)
      const c3 = (n + 2) + tileSuit(first)
      const have2 = counts[c2] > 0
      const have3 = counts[c3] > 0
      const need = (have2 ? 0 : 1) + (have3 ? 0 : 1)
      if (need <= caishen) {
        const cc = cloneCounts(counts)
        cc[first] -= 1
        if (have2) cc[c2] -= 1
        if (have3) cc[c3] -= 1
        if (tryMelds(cc, caishen - need)) return true
      }
    }
  }
  return false
}

// ============ 听牌检测 ============
// handCodes: 长度13的code数组，返回所有能胡的牌code
function getTenpai(handCodes, caishenCode) {
  const waits = {}
  const allCodes = allTileCodes()
  for (const c of allCodes) {
    const test = handCodes.concat([c])
    if (canWin(test, caishenCode)) waits[c] = true
  }
  return Object.keys(waits)
}

// 是否听牌
function isTenpai(handCodes, caishenCode) {
  return getTenpai(handCodes, caishenCode).length > 0
}

// ============ 副露/吃碰杠胡检测 ============
// 碰：手中有2张与 discarded 相同
function canPeng(handCodes, discarded) {
  let cnt = 0
  for (const c of handCodes) if (c === discarded) cnt++
  return cnt >= 2
}

// 明杠：手中有3张与 discarded 相同
function canMingGang(handCodes, discarded) {
  let cnt = 0
  for (const c of handCodes) if (c === discarded) cnt++
  return cnt >= 3
}

// 暗杠：手中有4张相同 (自己回合)
function getAnGangCodes(handCodes) {
  const m = countCodes(handCodes)
  return Object.keys(m).filter(k => m[k] >= 4)
}

// 加杠：已碰的刻子 + 手中拿到第4张
function getJiaGangCodes(handCodes, melds) {
  const result = []
  const handM = countCodes(handCodes)
  for (const meld of melds) {
    if (meld.type === 'peng' && handM[meld.code] >= 1) {
      result.push(meld.code)
    }
  }
  return result
}

// 吃：仅能吃上家弃牌，返回所有可能的吃组合
// 每种组合: { type:'chi', code: discarded, with:[c1,c2] (手牌中两张) }
function getChiCombos(handCodes, discarded) {
  if (isHonor(discarded)) return []
  const combos = []
  const n = tileNum(discarded)
  const s = tileSuit(discarded)
  const m = countCodes(handCodes)
  // discarded 可在顺子的 位置0/1/2
  // 位置0: discarded, n+1, n+2
  if (n <= 7) {
    const b = (n + 1) + s, c = (n + 2) + s
    if (m[b] >= 1 && m[c] >= 1) combos.push({ type: 'chi', code: discarded, with: [b, c] })
  }
  // 位置1: n-1, discarded, n+1
  if (n >= 2 && n <= 8) {
    const a = (n - 1) + s, c = (n + 1) + s
    if (m[a] >= 1 && m[c] >= 1) combos.push({ type: 'chi', code: discarded, with: [a, c] })
  }
  // 位置2: n-2, n-1, discarded
  if (n >= 3) {
    const a = (n - 2) + s, b = (n - 1) + s
    if (m[a] >= 1 && m[b] >= 1) combos.push({ type: 'chi', code: discarded, with: [a, b] })
  }
  return combos
}

// 点炮胡：弃牌能否让自己胡
function canHuOnDiscard(handCodes, discarded, caishenCode) {
  return canWin(handCodes.concat([discarded]), caishenCode)
}

function countQuadruples(handCodes, caishenCode) {
  const m = countCodes(handCodes)
  let quad = 0
  for (const k in m) {
    if (m[k] >= 4) quad++
  }
  return quad
}

// ============ 番数计算 (杭州麻将 - 基于麻将来了规则) ============
// 返回 { fan, desc[] }
// 1倍: 平胡
// 2倍: 杠开, 七对, 爆头
// 4倍: 杠爆, 豪华七对
// 8倍: 杠飘, 飘杠, 双豪华七对
// 16倍: 三豪华七对
// 加倍: 庄
function calcFan(state, winnerIdx, winTile, isZimo, isChiHu) {
  const p = state.players[winnerIdx]
  const handCodes = p.hand.map(t => t.code)
  const allHand = handCodes.concat([winTile])
  const caishen = allHand.filter(c => c === state.caishen).length
  const melds = p.melds
  const desc = []
  let fan = 1

  const isSeven = isSevenPairs(allHand, state.caishen)
  const hasGangKai = isZimo && state.lastGangBy === winnerIdx
  const hasBaotou = caishen === 1 && !isSeven
  const hasCaipiao = p.caipiao && caishen === 1

  if (isSeven) {
    const quads = countQuadruples(allHand, state.caishen)
    if (quads >= 3) {
      fan = 16
      desc.push('三豪华七对')
    } else if (quads >= 2) {
      fan = 8
      desc.push('双豪华七对')
    } else if (quads >= 1) {
      fan = 4
      desc.push('豪华七对')
    } else {
      fan = 2
      desc.push('七对')
    }
  } else {
    desc.push('平胡')
    if (hasBaotou) {
      fan = 2
      desc.push('爆头')
    }
    if (hasCaipiao) {
      desc.push('财飘')
    }
    if (hasGangKai) {
      if (hasBaotou) {
        fan = 4
        desc.push('杠爆')
      } else if (hasCaipiao) {
        fan = 8
        desc.push('杠飘')
      } else {
        fan = 2
        desc.push('杠开')
      }
    }
  }

  if (state.dealer === winnerIdx) {
    desc.push('庄')
  }

  return { fan, desc }
}

// ============ AI ============
// AI 选弃牌：评分最低的弃掉
function aiChooseDiscard(handCodes, caishenCode, melds) {
  // 若某张弃掉后听牌，优先保留；这里简化：综合评分
  const m = countCodes(handCodes)
  const codes = Object.keys(m)
  let best = codes[0]
  let bestScore = -Infinity
  for (const c of codes) {
    if (c === caishenCode) continue // 财神不弃
    let score = 0
    const n = tileNum(c)
    const isH = isHonor(c)
    // 对子/刻子价值高
    if (m[c] >= 3) score += 80
    else if (m[c] === 2) score += 45
    // 顺子邻接
    if (!isH) {
      const s = tileSuit(c)
      if (m[(n - 1) + s] || m[(n + 1) + s]) score += 25
      if (m[(n - 2) + s] && m[(n - 1) + s]) score += 20
      if (m[(n + 1) + s] && m[(n + 2) + s]) score += 20
      // 中张价值
      if (n >= 3 && n <= 7) score += 8
      else score += 2 // 边张
    } else {
      score += 6 // 单张字牌
    }
    // 弃掉后是否听牌
    const rest = handCodes.filter(x => x !== c)
    if (isTenpai(rest, caishenCode)) score += 200
    if (score > bestScore) { bestScore = score; best = c }
  }
  // 全是财神的情况兜底
  if (best === undefined) return handCodes[0]
  return best
}

// AI 决定是否吃碰杠胡 (返回动作或 null)
function aiDecideClaim(state, playerIdx, discarded) {
  const p = state.players[playerIdx]
  const handCodes = p.hand.map(t => t.code)
  // 胡
  if (canHuOnDiscard(handCodes, discarded, state.caishen)) {
    return { type: 'hu', code: discarded }
  }
  // 杠
  if (canMingGang(handCodes, discarded) && Math.random() < 0.7) {
    return { type: 'gang', code: discarded }
  }
  // 碰
  if (canPeng(handCodes, discarded) && Math.random() < 0.5) {
    return { type: 'peng', code: discarded }
  }
  // 吃 (仅上家)
  return null
}

// ============ 游戏状态 ============
function createGame(prevDealer) {
  const deck = shuffle(createDeck())
  // 固定财神：白板永远是财神
  const caishen = determineCaishen()

  // 随机庄家（0-3）
  let dealer = Math.floor(Math.random() * 4)
  if (typeof prevDealer === 'number' && prevDealer >= 0) {
    // 上一局庄家胡牌则连庄，否则下家坐庄
    // 简化：随机
  }

  const players = []
  for (let i = 0; i < 4; i++) {
    const hand = deck.splice(0, 13)
    hand.sort((a, b) => a.code.localeCompare(b.code))
    players.push({
      idx: i,
      name: i === 0 ? '我' : '电脑' + i,
      hand,
      melds: [],         // [{type, code, tiles:[...]}]
      discards: [],      // [{code, id}]
      isHuman: i === 0
    })
  }

  return {
    deck,
    wallTail: deck.length, // 用于杠后补牌
    caishen,
    dealer,                // 庄家索引
    currentPlayer: dealer, // 从庄家开始
    phase: 'draw',         // draw / discard / claim / over
    lastDiscard: null,     // { code, player, id }
    lastGangBy: -1,
    claimFor: -1,          // 待响应的玩家
    claimOptions: [],      // 可用动作
    winner: -1,
    winTile: null,
    winInfo: null,
    players,
    log: []
  }
}

// 从牌尾摸牌 (杠后补牌也从牌尾)
function drawTile(state, playerIdx) {
  if (state.deck.length === 0) return null
  let tile
  // 杭州麻将：杠后从牌尾补，普通摸牌从牌头；这里简化都用牌头
  tile = state.deck.shift()
  return tile
}

function sortHand(hand) {
  const suitOrder = { p: 0, s: 1, m: 2, z: 3 }
  const charOrder = ['1','2','3','4','5','6','7','8','9','东','南','西','北','中','发','白']
  hand.sort((a, b) => {
    const ca = a.code
    const cb = b.code
    const sa = ca.slice(-1)
    const sb = cb.slice(-1)
    if (suitOrder[sa] !== suitOrder[sb]) return suitOrder[sa] - suitOrder[sb]
    const va = ca.slice(0, -1)
    const vb = cb.slice(0, -1)
    const ia = charOrder.indexOf(va)
    const ib = charOrder.indexOf(vb)
    if (ia !== ib) return ia - ib
    return a.id - b.id
  })
}

// 页面级运行时状态：避免放在 VM data 中触发深度响应式观察
const ui = {
  game: null,
  drawnTileId: -1,
  timers: [],
  playerPassed: false,
  selfGangCodes: [],
  pendingChiCombos: [],
  claimList: [],

  reset() {
    for (const id of ui.timers) clearTimeout(id)
    ui.game = null
    ui.drawnTileId = -1
    ui.timers = []
    ui.playerPassed = false
    ui.selfGangCodes = []
    ui.pendingChiCombos = []
    ui.claimList = []
  },
  later(fn, ms) {
    const id = setTimeout(fn, ms)
    ui.timers.push(id)
    return id
  }
}

export default {
  allTileCodes,
  tileName,
  tileColor,
  isHonor,
  tileNum,
  tileSuit,
  createDeck,
  shuffle,
  determineCaishen,
  canWin,
  isSevenPairs,
  getTenpai,
  isTenpai,
  canPeng,
  canMingGang,
  getAnGangCodes,
  getJiaGangCodes,
  getChiCombos,
  canHuOnDiscard,
  calcFan,
  aiChooseDiscard,
  aiDecideClaim,
  createGame,
  drawTile,
  sortHand,
  ui
}
