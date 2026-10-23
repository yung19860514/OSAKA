// 劇情對話（簡體）：第一次打某關「之前」或通關「之後」播放，看過就不再播（存檔 story）
// who：lia 莉亚｜borg 博格｜king 国王｜goblinking 哥布林王
export const CHARS = {
  lia:        { name: '莉亚', tex: 'avatar_lia', side: 'left' },
  borg:       { name: '博格', tex: 'avatar_borg', side: 'left' },
  king:       { name: '国王', tex: 'avatar_king', side: 'left' },
  goblinking: { name: '哥布林王', tex: 'avatar_goblinking', side: 'right' },
  witch:      { name: '沼泽女巫', tex: 'avatar_witch', side: 'right' },
  pirate:     { name: '海盗船长', tex: 'avatar_pirate', side: 'right' },
  frostgiant: { name: '冰霜巨人', tex: 'avatar_frostgiant', side: 'right' },
  lavademon:  { name: '熔岩恶魔', tex: 'avatar_lavademon', side: 'right' },
  shadowking: { name: '暗影骨王', tex: 'avatar_shadowking', side: 'right' },
  elsa:       { name: '艾莎', tex: 'avatar_elsa', side: 'left' },
};

export const STORY = {
  ch1_start: {
    chapter: 1,
    before: 1,
    lines: [
      ['king', '小队长莉亚！暗影骨王打碎了魔晶之心，边境的魔物全都醒了！'],
      ['lia', '放心交给我，陛下。要塞的大门绝不会被攻破！'],
      ['borg', '嘿，小队长！我是矮人工匠博格。我造的魔导塔，用魔力就能召唤出来。'],
      ['borg', '记住：把两座一样的塔拖到一起，就能合体变得更强！'],
      ['lia', '哥布林来了……全员准备迎敌！'],
    ],
  },
  ch1_mid: {
    chapter: 1,
    before: 8,
    lines: [
      ['borg', '奇怪，哥布林怎么越打越多？它们身上有魔晶碎片的光！'],
      ['lia', '碎片？是魔晶之心的碎片吗？'],
      ['borg', '没错！把碎片抢回来，我就能做出更厉害的零件，帮塔升阶。'],
      ['lia', '那就一路打到哥布林营地去！'],
    ],
  },
  ch1_boss: {
    chapter: 1,
    before: 15,
    lines: [
      ['goblinking', '嘎哈哈！魔晶碎片是骨王大人赏给我的，谁也别想拿走！'],
      ['lia', '哥布林王……原来是你在背后指挥！'],
      ['borg', '小心！它骑着巨狼，冲锋的时候特别快！'],
      ['lia', '所有塔准备！今天就在这里结束！'],
    ],
  },
  ch1_end: {
    chapter: 1,
    after: 15,
    lines: [
      ['goblinking', '不、不可能……骨王大人不会放过你们的……'],
      ['lia', '第一块碎片，拿回来了！'],
      ['borg', '咦？碎片上有沼泽的味道……剩下的碎片，可能在迷雾沼泽。'],
      ['lia', '下一站，迷雾沼泽！'],
    ],
  },
  ch2_start: {
    chapter: 2, before: 16,
    lines: [
      ['borg', '咳咳……这雾好臭！小队长，把鼻子捂好。'],
      ['lia', '迷雾沼泽……碎片的气味就是从这里传来的？'],
      ['borg', '小心那些蘑菇怪，打死它们会喷出毒雾，周围的塔会变慢。'],
      ['lia', '那就趁它们靠近塔之前解决掉！'],
    ],
  },
  ch2_mid: {
    chapter: 2, before: 23,
    lines: [
      ['borg', '树人皮太厚了，冰霜塔只能冻住它一半！'],
      ['lia', '那就多放火炮塔和毒雾塔，慢慢磨。'],
      ['borg', '还有蝙蝠，飞得快但很脆，弩箭塔一箭一个。'],
    ],
  },
  ch2_boss: {
    chapter: 2, before: 30,
    lines: [
      ['witch', '嘻嘻嘻……魔晶碎片让我的沼泽长得多么美丽啊。'],
      ['lia', '你用碎片养毒雾，害得整片沼泽都变成这样！'],
      ['witch', '敢来抢？我把你的塔通通变成青蛙！'],
      ['borg', '变成青蛙的塔几秒内不能攻击，要多准备几座！'],
    ],
  },
  ch2_end: {
    chapter: 2, after: 30,
    lines: [
      ['witch', '呜……骨王大人说过，只要把碎片送到海湾……'],
      ['lia', '海湾？说清楚！'],
      ['witch', '骸骨海湾的海盗船……会把所有碎片运去暗影城堡……'],
      ['borg', '下一站，骸骨海湾！'],
    ],
  },
  // ───── 第 3 章：骸骨海灣 ─────
  ch3_start: {
    chapter: 3, before: 31,
    lines: [
      ['lia', '好大的海风……那艘破船就是女巫说的海盗船？'],
      ['borg', '船上全是骷髅兵。小心，有些打倒了还会爬起来！'],
      ['lia', '那就多打一下，让它们爬不起来。'],
    ],
  },
  ch3_mid: {
    chapter: 3, before: 38,
    lines: [
      ['borg', '举着盾的骷髅海盗，弩箭和闪电都被挡掉一半。'],
      ['lia', '那就用火炮塔，从上面砸下去！'],
      ['borg', '还有木乃伊，毒雾对它没用，别浪费格子。'],
    ],
  },
  ch3_boss: {
    chapter: 3, before: 45,
    lines: [
      ['pirate', '呦吼吼！碎片要运去暗影城堡，谁也拦不住我的船！'],
      ['lia', '你的船，今天就在这里沉了！'],
      ['pirate', '炮手准备！把她的塔轰成渣！'],
      ['borg', '被炮弹打中的塔会晕几秒，别全挤在一起！'],
    ],
  },
  ch3_end: {
    chapter: 3, after: 45,
    lines: [
      ['pirate', '咳……一半的碎片早就送上冰封山脉了……'],
      ['borg', '山上有守山神镇守，海盗怎么过得去？'],
      ['pirate', '守山神？嘿嘿，它早就被骨王大人控制了……'],
      ['lia', '下一站，冰封山脉！'],
    ],
  },
  // ───── 第 4 章：冰封山脈 ─────
  ch4_start: {
    chapter: 4, before: 46,
    lines: [
      ['borg', '好、好冷……我的胡子都结冰了。'],
      ['lia', '冰狼来了！它们跑得好快，冰霜塔也只能冻住一半。'],
      ['borg', '用弩箭塔和闪电塔，趁它们冲过来之前打掉！'],
    ],
  },
  ch4_mid: {
    chapter: 4, before: 53,
    lines: [
      ['lia', '那只白色的大家伙是什么？'],
      ['borg', '雪怪！它根本不怕冰冻，只能硬打。'],
      ['lia', '把塔合体到高等级，跟它拼了！'],
    ],
  },
  ch4_boss: {
    chapter: 4, before: 60,
    lines: [
      ['frostgiant', '……入侵者……离开……山……'],
      ['lia', '它的眼睛在发紫光，是被骨王控制了！'],
      ['borg', '它一跺脚，我们的塔会全部冻住，撑过去就好！'],
      ['lia', '打醒它！'],
    ],
  },
  ch4_end: {
    chapter: 4, after: 60,
    lines: [
      ['frostgiant', '……我醒了。谢谢你们，小小的勇士。'],
      ['elsa', '守山神大人！我是山上的冰霜法师艾莎，我一直在等有人来救你。'],
      ['elsa', '骨王的碎片往熔岩深渊去了，让我跟你们一起走！'],
      ['lia', '欢迎加入，艾莎！'],
    ],
  },
  // ───── 第 5 章：熔岩深淵 ─────
  ch5_start: {
    chapter: 5, before: 61,
    lines: [
      ['borg', '这里热得我的扳手都快化了！'],
      ['lia', '那些小火鬼……打死它们会爆炸！'],
      ['borg', '爆炸会让旁边的塔晕一下，而且它们不怕火炮！'],
    ],
  },
  ch5_mid: {
    chapter: 5, before: 68,
    lines: [
      ['lia', '那块大石头一边走一边生出小火鬼！'],
      ['borg', '熔岩石魔！优先集火它，不然小鬼会越来越多。'],
    ],
  },
  ch5_boss: {
    chapter: 5, before: 75,
    lines: [
      ['lavademon', '哈哈哈！我的熔炉马上就要铸出新的魔晶之心了！'],
      ['lia', '假的心！骨王想用它控制整片大陆！'],
      ['lavademon', '烧吧！把你们的阵地通通烧光！'],
      ['borg', '被烧的格子暂时不能用，塔要分散放！'],
    ],
  },
  ch5_end: {
    chapter: 5, after: 75,
    lines: [
      ['lavademon', '不……熔炉……熄灭了……'],
      ['lia', '碎片都回来了，只剩骨王身上那一块。'],
      ['borg', '暗影城堡，就在前面。'],
      ['lia', '大家，最后一战了！'],
    ],
  },
  // ───── 第 6 章：暗影城堡 ─────
  ch6_start: {
    chapter: 6, before: 76,
    lines: [
      ['borg', '城堡里什么怪都有……好像把一路上的敌人都叫来了。'],
      ['lia', '我们一路打过来，这些都不怕！'],
    ],
  },
  ch6_mid: {
    chapter: 6, before: 83,
    lines: [
      ['lia', '越往里走，空气越冷……'],
      ['borg', '骨王就在王座上。小队长，零件和塔都准备好了吗？'],
      ['lia', '准备好了。为了灯火王国！'],
    ],
  },
  ch6_boss: {
    chapter: 6, before: 90,
    lines: [
      ['shadowking', '渺小的人类……你们竟然走到了这里。'],
      ['lia', '暗影骨王莫克！把魔晶之心的最后一块碎片交出来！'],
      ['shadowking', '来吧！让我的影子们陪你们玩玩！'],
      ['borg', '它每掉一截血就会召唤影子、冻住塔，撑住！'],
    ],
  },
  ch6_end: {
    chapter: 6, after: 90,
    lines: [
      ['shadowking', '不可能……魔晶之心……不止一颗……'],
      ['lia', '你说什么？'],
      ['borg', '碎片全部回来了！魔晶之心……修好了！'],
      ['lia', '可是他说的第二颗心……我们的冒险还没结束。'],
    ],
  },
};

export const storyBefore = n => Object.keys(STORY).find(k => STORY[k].before === n);
export const storyAfter = n => Object.keys(STORY).find(k => STORY[k].after === n);
