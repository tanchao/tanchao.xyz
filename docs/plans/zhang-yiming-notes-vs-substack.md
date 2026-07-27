# 张一鸣 notes 溯源 + 与我的 Substack notes 对比

内部研究笔记，不发布、不改站点。目的：从张一鸣早期公开思考记录中学到一些关于「怎么记 notes」的东西，反过来照一照自己的 Substack notes（`src/content/notes/substack-*.md`）。

## 0. 先纠正一个前提：不是饭否，是微博

**饭否没有可验证的公开存档。** 张一鸣 2008–2009 在饭否是**技术合伙人**（跟王兴、王慧文那批人，负责搜索/消息分发/防作弊），不是那个平台上「写思考」的知名用户；饭否 2009 年 7 月被关停，团队解散（[饭否 - 维基百科](https://zh.wikipedia.org/zh-cn/%E9%A5%AD%E5%90%A6)）。网上找不到任何一份张一鸣本人在饭否发言的公开备份。

这不是「饭否类存档天然消失」——张小龙（同期饭否用户）留下了一份带精确时间戳、逐条编号的[《张小龙2359条饭否日记（全文）》](https://www.52cs.com/archives/story/%E5%BC%A0%E5%B0%8F%E9%BE%992359%E6%9D%A1%E9%A5%AD%E5%90%A6%E6%97%A5%E8%AE%B0%EF%BC%88%E5%85%A8%E6%96%87%EF%BC%89)，格式跟本报告下面处理张一鸣微博语料的方式几乎一样，说明「原始饭否存档」这个东西是存在的，只是张一鸣不在其中。这印证了上一句的判断：他在饭否是后端搭建者，不是那个平台上高频公开输出思考的用户，所以没有留下这类记录，跟平台本身是否可存档无关。

真正被创业圈反复通读、整理、传播的，是他 **2009–2018 年在新浪微博**（`weibo.com/zhangyiming`）上的原创短帖，尤其 **2010–2011 密度最高**，2012 年开始做今日头条后大量变成转发头条文章的外链，原创内容明显变少（多篇独立文章一致提到这个转折点）。这份东西大概是你记忆里「饭否」和「微博」被混称了——下面全部按微博处理。

## 1. 语料地图：什么最全、什么最真

| 层级 | 来源 | 完整度 | 真实性判断 | 用途 |
|---|---|---|---|---|
| A. 原始平台 | [weibo.com/zhangyiming](https://weibo.com/zhangyiming) | 低（现只展示近半年） | 最高，但看不到历史 | 抽查、核对措辞 |
| B. 精选 231 条（有主题分桶，无日期） | 霍仟《围观了张一鸣近10年的微博》，[36氪转载](https://36kr.com/p/1130403944133122)；可直接读的 PDF 镜像：[hellowac 镜像](https://hellowac.github.io/other/files/1_%E5%BC%A0%E4%B8%80%E9%B8%A3%E5%BE%AE%E5%8D%9A.pdf) | 中（人工筛选） | 中高——摘录方式清楚，且与下面 C、D 的带日期引文有多处重合，可交叉验证 | **主阅读语料，本报告主要引用来源** |
| C. 34 条精选（**带精确日期**，来自通读 2285 条） | 人人都是产品经理，[《看完张一鸣9年2285条微博之后》](https://www.woshipm.com/kol/912119.html) | 低（数量少） | 高——逐条标注年-月-日 时:分，可核对 | 给 B 的无日期引文做时间锚点 |
| D. 2010 年专题深读（大量带日期原文） | 卢松松博客，[《我爬了张一鸣2200条微博》](https://lusongsong.com/info/post/12457.html) | 中 | 高——叙述里穿插原文，且明确提到「这条微博在2011年又出现了一次」这种回溯性观察 | **本报告"深度"维度的关键证据**（他怎么显式追踪自己反复出现的母题） |
| E. ~2285–2880 条全量 PDF | [老郭种树下载页](https://guozh.net/zhang-yiming-weibo-pdf/)（蓝奏云网盘，需密码） | 声称最高 | **无法验证**——下载页本身带明显引流站特征，内容未经核对；不建议作为一手引用 | 仅作「存在这个数量级的完整爬取」的旁证，不引用具体条目 |
| F. 二次框架化（演讲、内部信、访谈合成） | GitHub [alchaincyf/zhang-yiming-skill](https://github.com/alchaincyf/zhang-yiming-skill) | 高（跨源合成） | 低——已经是别人重新解释、打了标签的产物 | 只用来交叉对照关键词（延迟满足感、高维投影、逃逸平庸的重力），不当一手引文 |

**交叉验证做法**：B（无日期）里的高频原则句，在 C、D（带日期）里能找到几乎逐字重复的版本，说明 B 的摘录基本忠实。例子——

- B 第 026 条「以后团队的工作……清楚不含糊要成为公司的文化」 ≈ C 第 3 条，标注日期 **2010-7-24 18:39**。
- B 第 053 条「为什么刷牙不能坚持认真刷……没有指标系统」 ≈ D 引文，标注 **2010年9月**，且 D 额外指出「这条微博在2011年又出现了一次，只是又加深了一个意义」——这是张一鸣自己在追踪自己反复写的主题，见下文第 3 节。

**结论**：不存在单一「最全」文件；**最接近真实、可读、可核对**的组合是 B（快速通读入口，40–60 分钟）+ D（2010 年深读，看他怎么把单条微博串成方法论）+ C（给 B 里模糊的时间感上锚点）。E 只作数量级参考，不引用其内容；F 不当一手材料。

## 2. 我的对照语料

- `src/content/notes/substack-*.md`，共 **127 条**，时间跨度 **2025-07-30 至 2026-07-20**（约 1 年）。
- 语言：121 条英文、6 条中文——中英混用但英文主导。
- 长度：中位数 197 字符，最短 6 字符（"P•SaaS"），最长 1241 字符；43 条超过 300 字符（field-note 级别），12 条不超过 60 字符（纯断言级别）。
- 月度产出 4–18 条不等，无明显衰减趋势（但观察窗口只有 1 年，不能类比张一鸣「2012 后原创变少」那种多年尺度的退化）。
- 主题命中（非互斥关键词统计）：AI/工具相关 42 条、产品与工程 28 条、原则/机制类 20 条、中美/宏观 19 条、生活/家庭/旅行 18 条、职业/工作 11 条。

## 3. 四维度对比

### 3.1 问题的方向

**张一鸣**在自己是 CEO 的坐标系里推演：信息分发机制该怎么设计、团队怎么招怎么留、自己该成为什么样的人。他把「我」和「组织」两条轨道一起优化，方向感是**「我要建成什么」**：

> 「未来会有更多的输入输出的创新让信息可流动，更多分发推荐的机制转动起来。」（2010-12-25，`weibo`，见来源 C 第1条）——这条后来直接投影成了今日头条。

> 「如何吸引人才：短期回报、长期回报、个人成长、精神生活……从易到难。」（2010-5-7，来源 C 第27条）

**我**在被系统/AI 冲击的坐标系里推演，方向感更接近**「这套机制会怎么变，我在里面怎么站住」**：

> "Now I need build an agent on top of Cursor/ClaudeCode to do my job, what should I *not* focus on? … Next, layoff me." （`substack-c-222671120.md`, 2026-03-04）

> "'Are Right A Lot' … the most generic good enough option for majority of our valuable customers." （`substack-c-169407769.md`, 2025-10-23）

**差异**：张一鸣的问题多数是「自上而下」——他在设计一个组织该怎么运转；我的问题多数是「自下而上」——先把自己放进一个已经存在的系统（公司、AI 工具链）里问怎么应对。两人共享「机制优于意愿」这个底层信念，但应用对象不同：他 2010 年代用它训练人类团队，我 2020 年代用它训练/约束 AI agent。这是同一原理换了应用对象，不是深度差异。

### 3.2 思考的深度

深度差异不在单条字数，在**同一母题是否被显式追踪**。

张一鸣把「延迟满足感」这个词在 231 条精选里就重复了至少 6 次（第 002、015、064、070、071、114 条），且第三方深读明确记录他**自己标注了复现**：

> 「这条微博在2011年又出现了一次，只是又加深了一个意义，我们将在《张一鸣的2011》会揭晓。」（来源 D）

这说明他把自己过去的帖子当数据在用——不是写完就丢，是隔年回来加深同一个判断，且把这个回访动作本身写进新的帖子里，让复利变得**可见**。

我这边也有真实存在的复现母题，但没有显式回指。用关键词扫了一遍 127 条，「AI 会不会替代工程师/新人 + mechanism 优于意愿」这条线，从 2025-08-01 到 2026-07-20 一共出现了 **18 次**，跨 11 个月：

> "explain code, explain tools … → rule based agent. how it happens automatically?" (`substack-c-141137867.md`, 2025-08-01)
>
> "the more i tailor my dev-agent, the more i realize how claude code were designed like this and why they chose it … an objective rule exists" (`substack-c-262293729.md`, 2026-05-20)
>
> "Next, layoff me." (`substack-c-222671120.md`, 2026-03-04)

18 条独立记录，同一个判断在被反复验证/修正，**但每条都从零写起**，没有一条说「这个想法我三月份写过」。复现的深度是真实的，只是需要脚本挖出来才看得见，不像张一鸣那样把回访动作变成写作本身的一部分。这是本报告里最值得直接改的一点，见第 4 节动作 1。

### 3.3 模式与方法论

**张一鸣**：

- 原则清单化——「四个要素」招人、「三点原则」处理不合格员工。
- 拉远时间尺度做判断——「离远一步，用更重要的原则和更长的时间尺度来衡量就清楚了」。
- 把语言精度当管理杠杆——专门列出要消灭的含糊词：「差不多」「大概可以」「过两三天」。
- 输入渠道明确：读传记、通读同行的全部微博（他把马化腾的微博也读了一遍）、公司内部读书会同步。
- 把行为指标化：「指标系统」——没有测量的事情做不好。
- 「高维投影」——复杂问题是简单问题在更高维度的投影，别在表象层优化。

**我**：

- mechanism > intention——直接继承自 Amazon 同事的原话，现在被我搬到 AI agent 设计和 Jira 任务追踪上。
- 列表拆解问题（what I should / should not focus on 这类结构）。
- 用具体小实验校准判断，而不是抽象断言——儿子游泳提速 5% 的空间拆解就是典型：先给目标、再对比视频找到具体可省的环节。
- 跨领域类比——「模型天生是懒的，就像人一样」。
- 相信证据而非立场——"Are Right A Lot"：先有观点，再去找这个观点为什么在证据上站得住。

**可学的具体差异**：张一鸣的方法论产出是「管人的规则」，我的方法论产出是「管系统/agent 的规则」——但语言精度纪律（消灭含糊词）这一条,他用在中文管理场景，我目前只在英文条目里做到了同等的直接，中文条目（比如生活类）还没有对自己做过这种审查，见动作 4。

### 3.4 notes 本身的形态

**张一鸣**：微博 140 字限制逼着极简；2009–2011 几乎全部原创，无图无格式；「没什么人跟他互动」但仍然坚持高频写——对内独白，不是表演。2012 年后大量变成转发头条文章链接，原创比例断崖式下降，这是内容被平台运营腐蚀的典型样本。

**我**：Substack notes 无字数限制，中英混杂但英文主导；中位数 197 字，但可以写到 1241 字的完整论证；一年 127 条，月度 4–18 条波动，暂未出现「沦为转发」的退化（样本期太短，1 年 vs 他的 9 年，不能类比）。更关键的结构性差异：我的 notes 从写下的第一刻就带 `sourceUrl` / `sourceId` frontmatter，通过 `npm run sync:substack` 同步进博客仓库——这是有意识的内容资产管理，张一鸣的微博是纯自留地，事后才被第三方爬走变成「遗产」。

**可学的是他的高峰期特征本身**：短、频繁、不预期互动、纯对内——不是他后期被内容运营腐蚀之后的样子。这两者容易被混在一起崇拜，但只有前者值得模仿。

## 4. 可执行的学习动作

1. **把「AI 替代工程师 / mechanism」这条母题显式标注成系列。** 你已经在天然写这个主题（18 条/11 个月），但每条都从零开始。下次写同一主题时，开头引用上一条的日期和结论，学张一鸣「这条微博在2011年又出现了一次，只是又加深了一个意义」的写法——不用改 schema，只要在正文里加一句形如 `(接续 2026-01-06 那条判断)` 的自引用，把复利变成写作本身的一部分，而不是留给以后有人拿脚本去挖。

2. **保留一段「纯对内、不设读者」的写作节奏**，对标张一鸣 2010 年「没什么人跟他互动但坚持写」的状态。你现在 127 条里对外分享感的条目（AI 观点、职场评论）和纯私密独白（长安大居不易、上海酒店对比）已经在混着写。不用改前端展示，但写的时候心里分层：这条是给读者，还是给一年后的自己——后一类可以更放松，不必强行得出结论。

3. **学他「拉远时间尺度」的技巧，专门用在你的 AI/职业焦虑母题上。** 他遇到判断不了的事就说「离远一步，用更重要的原则和更长的时间尺度来衡量」。你的「layoff me」「resilience matters」系列已经有真实的情绪张力，缺一条把它们放到 3–5 年尺度上重新检验的复盘——比如年底写一条「回看今年这 18 条关于 AI 替代的判断，哪些被验证、哪些被证伪」。

4. **借用「清楚不含糊」的语言精度纪律，审查一遍中文条目。** 他把「差不多/大概/还行」当管理杠杆去消灭。你的英文 notes 已经足够直接，但中文条目（长安大居不易一类）还没做过同等审查——看看是否有含糊词，在你真正想下判断的地方被用来和稀泥。

5. **补一条「通读同行」的输入动作。** 他把马化腾的全部微博读了一遍，再写自己的判断。你现在对比的对象通常是同事或公开事件的碎片；挑一位同领域 builder（工程/AI/创业方向）的公开写作史，完整读一遍，专门记录「他在什么信息密度下做出了什么判断」，作为你自己 mechanism 系列的外部校准点。

## 5. 不必模仿的 3 处

第 4 节是「学什么」；这一节是边界——并行研究里有一份只落在 chat、没写进文件的 memo，专门标了三处不该抄。并进来，免得只剩正面动作。

1. **格言腔本身不必模仿。**「平庸有重力，需要逃逸速度」这种句式适合创业者对外立人格，但你的 notes 目前的工程速记感反而是优点——它更诚实，也更适合日后被你自己重新检索利用。

2. **单一原则的重复度不必刻意拉满。** 张一鸣十年只打磨几个词，是因为他所在的阶段（组织从 0 到 1）确实需要这种收敛。你所在的阶段（AI 范式快速变化）本身就需要更高的假设更新频率，横向广度对你更合理，不必为了「显得深刻」硬去重复用词。这和动作 1（对已有母题做显式回访）不冲突：回访是加深同一判断，不是把所有写作都压成同一个口号。

3. **不必追求被后人整理成「XX 条干货」。** 这是结果，不是目标。刻意为传播优化，容易让 notes 从诚实记录退化成表演性发言——这恰恰是张一鸣本人后期微博（转发头条文章变多、原创变少）掉进去的坑，值得当反面参考而不是正面模仿。第 3.4 节「可学的是他的高峰期特征」说的是同一件事的正面版。

## 6. 练习：把四个动作用在自己身上

第 4 节是分析，第 5 节是边界，这一节是练习——挑真实的 `src/content/notes/` 条目，直接动手做一遍，不是空谈方法论。四个练习对应四个具体、可复用的动作，以后写新 note 时可以直接套。

### 6.1 给一条纯技术清单加一段"底层逻辑抽象"

**原文（`substack-c-142831360.md`, 2025-08-06）：**

> If I have to quantify an engineering org, here are the top metrics:
> - time to spin up a dev environment from scratch
> - circle time to redeploy changes and run tests
> - CI time to validate a change
> - CD time to release a change
> - time to add metrics and able to monitor
> - change management effort and observations

**加一段抽象（新写，不改原文，作为练习示范）：**

> None of these six lines is really a separate metric. They're six samples of the same underlying quantity: the latency of one feedback loop, from "I changed something" to "I can see whether it worked." An org that's slow on all six isn't six problems, it's one — the loop is long — and fixing item 3 (CI time) while item 1 (dev-env spin-up) stays broken just moves the bottleneck, it doesn't remove it. This is Little's Law in disguise: throughput is bounded by loop latency times how much work is in flight, not by how hard any single stage tries.

**对比张一鸣：** 他的抽象动作是拉远时间尺度（"用更重要的原则和更长的时间尺度来衡量"），落点是人的心智原则。这里的抽象动作是拆掉表面清单，找系统里唯一真正的变量，落点是排队论/系统论。同一个"别停在表象层"的动作，用在了不同对象上。

### 6.2 把一条真实的愤怒重写成一条客观规律

**原文（`substack-c-143244153.md`, 2025-08-07）：**

> I'm angry because I lost interest to fix things, I started complaining instead.
> I'm angry because I cannot fix things.
> I'm angry because things are not working as expected.
> I'm angry that I worked late hours and pushed hard but failed to get it in.
> I'm angry, but no one cares.

**用经济学/系统论视角重写（新写）：**

> This isn't five complaints, it's one broken feedback loop seen from five angles. Effort went in (late hours, pushed hard); no channel existed to convert that effort into a visible, acknowledged outcome (fix lands, someone notices). When input has no path to a measurable output, the system doesn't stay neutral — it converts the surplus effort into complaint, because complaint is the cheapest remaining action that still signals the input was real. The fix isn't "try harder" or "care less," it's rebuild the channel (make the outcome visible and attributable), or resize the effort to match the channel that actually exists.

**对比张一鸣：** 他处理情绪的默认动作是"离远一步，用更重要的原则和更长的时间尺度来衡量"——把情绪放到时间轴上稀释。这里用的是拆机制图（input → channel → output）——把情绪放到系统图上定位成因。两条路径都绕开了"情绪本身"，直接绕到它的成因结构，只是切入的坐标轴不同（时间 vs. 结构）。

### 6.3 在追 AI 工具迭代的同时，写一条"十年不变量"

**种子（`substack-c-251375743.md`, 2026-04-30）：**

> The interesting fact is that good enough... a capable enough model is just enough. Soon open models will catch up, inferences will compete... Business moat will stand long, not due to intelligence, but due to domain insights.

**展开成完整的十年不变量判断（新写）：**

> 会变的：谁的模型这个月最强、token 便宜到什么程度、哪个 lab 领先几个月——这是每季度重排的排行榜，追它的成本很高，收益在半年内清零。4.6 到 4.7 的更替就是最新一例：工程师用脚投票留在"够用"的那一档，说明智能差距本身不构成粘性。
>
> 不会变的（未来十年）：谁先接触到某个垂直领域里真实、脏、没被写成 benchmark 的数据和判断（domain insight）；谁掌握分发和信任（distribution & trust）——用户为什么把敏感的工作交给你而不是能力相近的另一个模型；组织把"够用了"转成产品和渠道优势的速度，而不是转成继续追分数的速度。这三条不会因为下一代模型发布而重排，因为它们本来就不在模型能力这根轴上。
>
> 可执行的判断：以后遇到"这个新模型/新工具值不值得马上跟"的问题，先问它落在哪根轴上——如果答案是"更强"，默认权重给低（下一版就会覆盖它）；如果答案是"我因此拿到了别人拿不到的领域数据或信任关系"，才值得真投入。

**对比张一鸣：** 他的"高维投影"讲的是同一件事的不同表象要收敛到同一个更高维的判断；这里的"不变量"讲的是不同时间点的判断要收敛到同一个不随时间轴移动的东西。方向相反（表象→本质 vs. 时间→不变），目的一致：少被当下的表象牵着走。

### 6.4 把一条长感悟压缩成 50 字以内的箴言

**原文（`substack-c-242908997.md`, 2026-04-13，约 470 字符）：**

> Resilience matters, many tech engineers live a competitive life both in technical tasks and mental health. The tricky part is, regardless how good they solve tech challenges, the mental challenges are quite so different. When life gets harder, that not good enough is a failure; growing to conquer any problems, study harder and practice more generally solved problems, but life and mental is different, there are always better stage and never a best stage, there are no right nor final solution. At a center stage, adding self awareness and family into the success metrics. The math and risk is easier to control. May you a peaceful mind and your family be good.

**压缩为思想箴言（43 字，新写）：**

> 技术有终局的解，心智没有，只有更好的下一段；把自我和家人算进指标，风险的数学会变简单。

**对比张一鸣：** 他的箴言产出天然受微博 140 字上限逼出来（"不装 B"、"选择比努力更重要，观念比选择更重要"），是平台约束的副产品。我这里的约束是人为设的（≤50 字），因为 Substack notes 没有字数上限——这条差异本身也是第 3.4 节的结论：他的极简是被逼的，我的极简如果要有，需要自己主动设约束，不会自然发生。

## 来源清单

- [饭否 - 维基百科](https://zh.wikipedia.org/zh-cn/%E9%A5%AD%E5%90%A6)
- [张一鸣 - 维基百科](https://zh.wikipedia.org/wiki/%E5%BC%A0%E4%B8%80%E9%B8%A3)
- [张小龙2359条饭否日记（全文）——用于对照，证明饭否类原始存档确实存在，只是张一鸣不在其中](https://www.52cs.com/archives/story/%E5%BC%A0%E5%B0%8F%E9%BE%992359%E6%9D%A1%E9%A5%AD%E5%90%A6%E6%97%A5%E8%AE%B0%EF%BC%88%E5%85%A8%E6%96%87%EF%BC%89)
- [围观了张一鸣近10年的微博，我整理了这231条干货（36氪转载）](https://36kr.com/p/1130403944133122)
- [同文 PDF 镜像（可直接读）](https://hellowac.github.io/other/files/1_%E5%BC%A0%E4%B8%80%E9%B8%A3%E5%BE%AE%E5%8D%9A.pdf)
- [看完张一鸣9年2285条微博之后，发现今日头条快速增长的秘密（人人都是产品经理）](https://www.woshipm.com/kol/912119.html)
- [我爬了张一鸣2200条微博，发现9年前他重点在做两件事（卢松松博客）](https://lusongsong.com/info/post/12457.html)
- [张一鸣微博 PDF 记录 2286 条完整版下载（老郭种树，未核实，仅作数量级参考）](https://guozh.net/zhang-yiming-weibo-pdf/)
- [alchaincyf/zhang-yiming-skill（GitHub，二次框架化，不作一手引用）](https://github.com/alchaincyf/zhang-yiming-skill)
