# 奶蛙名画横屏壁纸

参考[奶蛙博物馆](https://neta.art/app/milk-frog-museum)的成熟奶蛙造型与名画融合方式，用内置 imagegen 生成八张横屏壁纸。前四张为第一批，后四张为新增备选。

八张图片均为 **1672 × 941 像素 PNG，约 16:9**，无文字、画框或水印。提示词请求尺寸为 2560 × 1440；实际交付保留生成工具输出的原生尺寸。人物集中在画面中右部，左侧保留相对安静的背景，方便主题叠加图标或文字。

| 文件 | 壁纸名 | 原作灵感 | 画面特点 |
| --- | --- | --- | --- |
| [01-pine-forest-morning.png](01-pine-forest-morning.png) | 松林晨蛙 | 伊万·希施金、康斯坦丁·萨维茨基《松林的早晨》 | 苔藓、倒木、晨雾与三只奶蛙；森林绿与金色晨光 |
| [02-lantern-garden-dusk.png](02-lantern-garden-dusk.png) | 花灯暮蛙 | 约翰·辛格·萨金特《康乃馨、百合、百合、玫瑰》 | 百合花园、纸灯笼与两只奶蛙；蓝紫暮色与暖光 |
| [03-skagen-blue-hour.png](03-skagen-blue-hour.png) | 蓝岸双蛙 | 佩德·塞韦林·克勒耶《斯卡恩南滩的夏夜》 | 海滩、披巾、双蛙与湿沙倒影；浅蓝与奶油色 |
| [04-red-fuji-clear-morning.png](04-red-fuji-clear-morning.png) | 赤富士望蛙 | 葛饰北斋《凯风快晴》 | 赤富士、横云与山前静坐奶蛙；浮世绘版画肌理 |

| [05-starry-frog-night.png](05-starry-frog-night.png) | 星夜听蛙 | 梵高《星月夜》 | 厚涂旋转星空与仰望星光的奶蛙 |
| [06-pearl-earring-frog.png](06-pearl-earring-frog.png) | 珍珠耳环蛙 | 维米尔《戴珍珠耳环的少女》 | 深色留白、蓝金头巾与珍珠 |
| [07-the-frog-scream.png](07-the-frog-scream.png) | 桥上呱喊 | 蒙克《呐喊》 | 火红天空、峡湾与捧脸惊叹的奶蛙 |
| [08-water-lily-frog.png](08-water-lily-frog.png) | 睡莲小憩 | 莫奈睡莲与日本桥题材 | 睡莲、绿桥和荷叶上的安静奶蛙 |

## 参考来源

- 奶蛙身份：博物馆页面中的“奶蛙档案”，温暖黄色梨形头身、浅奶油腹部、浅绿眼环与居中黑瞳、极短嘴线、橄榄棕手脚。
- 绘画融合示例：馆藏《撑阳伞的奶蛙》与《星月奶蛙夜》，参考同一角色融入笔触、颜料与光照的方式。
- 《松林的早晨》：[特列季亚科夫画廊杂志作品资料](https://www.tg-m.ru/catalog/en/picture/20603)。
- 《康乃馨、百合、百合、玫瑰》：[Tate 作品页](https://www.tate.org.uk/art/artworks/sargent-carnation-lily-lily-rose-n01615)。
- 《斯卡恩南滩的夏夜》：[原作资料](https://en.wikipedia.org/wiki/Summer_Evening_on_Skagen%27s_Southern_Beach)。
- 《凯风快晴》：[大都会艺术博物馆作品页](https://www.metmuseum.org/art/collection/search/36490)。

## 生成记录

生成模式：内置 image_gen。完整的共同提示词、每张图的独立提示词与参考素材链接保存在 [prompts.json](prompts.json)。图片已逐张目视检查，并核对文件尺寸。

新增四幅的完整提示词保存在 [extra-prompts.json](extra-prompts.json)，使用内置 imagegen，逐张检查后保留原生输出尺寸。
