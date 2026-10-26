export const FROG_QUOTES = [
  '不要总是低头赶路。偶尔抬头看看，天花板有没有漏水。',
  '只要把问题放进冰箱，它就会变成冷知识。',
  '人生没有白走的路，但有走错以后还嘴硬的路。',
  '真正的自律，是在决定躺平以后，每天坚持躺平。',
  '当你觉得自己一无所有，至少你还有点饿。',
  '不要害怕走得慢。只要方向够随意，哪里都是顺路。',
  '水到渠成的前提是，先确认自己没有站在漏勺里。',
  '生活给了你柠檬，就问问奶茶店能不能代加工。',
  '与其内耗自己，不如外耗一块充电宝。',
  '心态放平，烦恼就会从圆的变成扁的。',
  '所谓成熟，就是香蕉已经有了自己的斑点。',
  '越是没有答案的时候，越要看看是不是忘了翻面。',
  '机会总是留给有准备的人，椅子留给先坐下的人。',
  '不要和时间赛跑，时间没有报名费，你有。',
  '人生如茶，最重要的是别把杯盖当饼干。',
  '如果生活没有给你回声，试试把麦克风打开。',
  '所有努力都会有回报，比如努力关灯，电费就会少一点。',
  '你要允许万物穿过自己，除了蚊子。',
  '站得高才能看得远，但坐下来比较不累。',
  '世上没有过不去的坎，只有过去以后又想起来的坎。',
  '放下执念的第一步，是先放下手里的遥控器。',
  '不要为昨天后悔。昨天的外卖，今天已经不能退了。',
  '一切皆有可能，尤其是你忘记自己来厨房干什么。',
  '懂得留白的人，通常还没有开始写。',
  '与其追求完美，不如先确认保存按钮在哪里。',
  '保持空杯心态，但记得先把奶茶喝完。',
  '风会带来答案，也会把你的发型带走。',
  '人不能总活在过去，冰箱里的蛋糕可以。',
  '当一扇门关上时，先看看是不是推拉方向反了。',
  '所有相遇都有意义，比如你和桌角。',
  '欲速则不达，除非是快递选了次日达。',
  '生活不止眼前的苟且，还有不知道放哪儿的充电线。',
  '先完成，再完美。先把这句念完，今天也算完成了一件事。',
  '别让情绪左右你，让转椅左右你。',
  '真正的松弛感，是橡皮筋已经找不到工作了。',
  '每个人都有自己的时区，奶蛙有自己的摸鱼区。'
];

export function pickFrogQuote(previous = -1, count = 36, random = Math.random) {
  if (count < 2) return 0;
  const valid = Number.isInteger(previous) && previous >= 0 && previous < count;
  const next = Math.min(count - (valid ? 2 : 1), Math.max(0, Math.floor(random() * (count - (valid ? 1 : 0)))));
  return valid && next >= previous ? next + 1 : next;
}

export function startupTiming(duration, rate = .6) {
  const seconds = Number.isFinite(duration) && duration > 0 ? duration : 5.042;
  const speed = [.5, .6, .75, 1].includes(rate) ? rate : .6;
  const total = seconds / speed, beforeExit = Math.max(0, total - 1.3);
  const captionTravel = Math.min(5.2, beforeExit * .68);
  return { rate: speed, total, transition: 1.3, transitionAt: Math.max(0, seconds - speed * 1.3), guard: Math.min(35000, (total + 8) * 1000), captionTravel, captionReveal: Math.min(4.2, captionTravel * .88) };
}
