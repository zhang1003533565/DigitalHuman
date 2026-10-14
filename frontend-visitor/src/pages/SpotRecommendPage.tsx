import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useRef, useCallback } from 'react'
import './SpotRecommendPage.css'

interface ScenicSpotCard {
  id: number
  collection: string
  scenicName: string
  spotName: string
  location: string
  images: string[]
  detailedIntroduction: string
  highlights: string[]
}

const ALL_SPOTS: ScenicSpotCard[] = [
  // 镜门寻迹·红韵乡途
  {
    id: 1,
    collection: '镜门寻迹·红韵乡途',
    spotName: '大境门长城',
    location: '河北省张家口市桥西区大境门景区（张家口市北环路附近，长城文化旅游带核心区域）',
    images: ['/home/dajingmengchangcheng1.jpg', '/home/dajingmenchangcheng3.jpg', '/home/dajingmenchangcheng2.png', '/home/dajingmenchangcheng4.jpg'],
    detailedIntroduction: '作为张家口城市象征，门楣"大好河山"气势雄浑，既是明清长城重要关隘、昔日张库大道的商贸起点，也见证了察哈尔地区近代革命风云；从这里出发，可沿古道深入周边村落，开启长城文化与红色乡土交织的乡野旅程',
    highlights: ['万里长城第一门', '张库大道起点','红色研学原点'],
    scenicName: ''
  },
  {
    id: 2,
    collection: '镜门寻迹·红韵乡途',
    spotName: '来远堡遗址公园',
    location: '河北省张家口市桥西区大境门街道大境门景区西南角',
    images: ['/home/laiyuanbu1.jpg', '/home/laiyuanbu3.jpg', '/home/laiyuanbu2.jpg'],
    detailedIntroduction: '紧邻大境门，是明代与大境门配套的商贸军堡，保留夯土城墙、古车辙遗迹；曾经是草原与中原物资互通的枢纽，如今活化成为长城文化研学节点，串联起通往周边乡村的徒步路线，带动近郊文旅发展。',
    highlights: ['明清互市古堡', '关城配套遗址', '历史徒步点'],
    scenicName: ''
  },
  {
    id: 3,
    collection: '镜门寻迹·红韵乡途',
    spotName: '张家口堡',
    location: '河北省张家口市桥西区堡子里街道鼓楼西街16号',
    images: ['/home/zjkb1.jpg', '/home/zjkb3.jpg', '/home/zjkb2.jpg'],
    detailedIntroduction: '有着"明清建筑博物馆"之称，完整保留古街巷、文昌阁、抡才书院；街巷深处藏有多处晋察冀时期革命旧址，在老院落与市井烟火之中，可以触摸长城脚下厚重的历史与红色记忆，也是本地非遗手作的聚集地。',
    highlights: ['六百年军堡', '老城烟火', '革命旧址集群'],
    scenicName: ''
  },
  {
    id: 4,
    collection: '镜门寻迹·红韵乡途',
    spotName: '安家沟生态旅游区',
    location: '河北省张家口市桥西区东窑子镇石匠窑村',
    images: ['/home/anjiaoguotongxue1.jpg', '/home/anjiaoguotongxue3.jpg', '/home/anjiaoguotongxue2.jpg'],
    detailedIntroduction: '坐落于石匠窑村内，峡谷溪流、山林清幽；村内留存察哈尔抗日活动旧址与地道遗迹，现已打造红色研学徒步线路；同时发展山地采摘、农家餐饮，以文旅流量带动村民增收，是长城脚下农旅融合的典型乡村样板。',
    highlights: ['峡谷溪流', '山林清幽', '红色研学徒步', '山地采摘', '农家餐饮'],
    scenicName: ''
  },
  {
    id: 5,
    collection: '镜门寻迹·红韵乡途',
    spotName: '清河影视城',
    location: '河北省张家口市桥西区东窑子镇清河村',
    images: ['/home/qingheyingyuan1.jpg', '/home/qingheyingyuan3.jpg', '/home/qingheyingyuan2.jpg'],
    detailedIntroduction: '依托清河村古村落改造，复原民国时期张家口街巷风貌；园区配套智慧农场、海棠采摘园、红色主题影视研学活动；以影视文旅引流，带动返乡创业、农产品外销，探索古村落活化振兴的新路径。',
    highlights: ['老张家口复刻街区', '智慧农场', '红色影视研学'],
    scenicName: ''
  },
  // 张垣风物·助农优品
  {
    id: 1,
    collection: '张垣风物·助农优品',
    spotName: '口蘑干',
    location: '张北坝上草原',
    images: ['/home/koumogan1.jpg','/home/koumogan2.jpg','/home/koumogan3.jpg'],
    detailedIntroduction: '张家口坝上草原特产口蘑干，肉质厚实鲜香，自古便是塞外名珍。当地打造标准化采摘、烘干加工产业链，依托文旅电商拓宽销路，带动农户增收。小小的山珍走出乡村，将坝上生态资源转化为经济收益，助力乡村特色产业振兴。',
    highlights: ['坝上山珍','生态农品', '助农特产'],
    scenicName: ''
  },
  {
    id: 2,
    collection: '张垣风物·助农优品',
    spotName: '小米',
    location: '蔚县',
    images: ['/home/xiaomi1.jpg','/home/xiaomi2.jpg'],
    detailedIntroduction: '蔚县小米古时为贡米，坝下充足光照造就金黄饱满米粒，熬粥香浓醇厚。当地发展谷子规模化种植，打造“蔚州贡米”区域品牌，延伸加工、线上销售链条，把杂粮资源变成富民产业，以特色杂粮产业助推乡村振兴。',
    highlights: ['蔚州贡米','杂粮佳品','地理标志'],
    scenicName: ''
  },
  {
    id: 3,
    collection: '张垣风物·助农优品',
    spotName: '莜面',
    location: '康保/张北坝上',
    images: ['/home/youmian1.jpg', '/home/youmian2.jpg','/home/youmian3.jpg'],
    detailedIntroduction: '坝上高寒地区盛产莜麦，制成莜面，是塞外传统主食，有“口外第一宝”的美誉。传承非遗“三生三熟”工艺，开发莜面窝窝、速食产品。依托乡村旅游展销，拓宽销路，带动坝上种植户稳定增收，以特色杂粮产业赋能乡村振兴。',
    highlights: ['坝上莜面','非遗美食','杂粮主食'],
    scenicName: ''
  },
  {
    id: 4,
    collection: '张垣风物·助农优品',
    spotName: '熏肉',
    location: '怀安县柴沟堡',
    images: ['/home/xunrou1.jpg', '/home/xunrou2.jpg'],
    detailedIntroduction: '柴沟堡熏肉是张家口非遗美食，经老汤卤制、柏木熏制，皮烂肉嫩、醇香不腻。当地扶持传统作坊标准化生产，结合文旅平台推广，传承古法技艺的同时拓展线上订单，让老字号美食带动村民就业，以特色美食产业助力乡村振兴。',
    highlights: ['非遗美食','塞外熏肉','传统卤味'],
    scenicName: ''
  },
  {
    id: 5,
    collection: '张垣风物·助农优品',
    spotName: '山杏干',
    location: '怀来县',
    images: ['/home/shanxiang1.jpg', '/home/shanxiang2.jpg','/home/shanxiang3.jpg'],
    detailedIntroduction: '张家口山区广泛种植山杏，自然晾晒制成山杏干，果肉厚实、酸甜原味，无过多添加。大力发展林果产业，就地加工果干产品，依托乡村旅游与电商对外销售，盘活荒山资源，让山野林果成为农户稳定收入来源，推动林果产业振兴。',
    highlights: ['山野果干','天然酸甜','林果特产'],
    scenicName: ''
  },
  {
    id: 6,
    collection: '张垣风物·助农优品',
    spotName: '土豆',
    location: '张北县',
    images: ['/home/tudou1.jpg', '/home/tudou2.jpg','/home/tudou3.jpg'],
    detailedIntroduction: '坝上冷凉气候孕育优质土豆，口感绵密。张家口是国内马铃薯良种基地，构建育种、种植、仓储、深加工完整产业链，打造“金豆豆”富民产业。通过电商、文旅展销扩大销量，带动大量农户就业，是坝上乡村振兴的支柱产业。',
    highlights: ['坝上土豆','种薯基地','富民农产'],
    scenicName: ''
  },
  // 长城栖居·乡居慢享
  {
    id: 1,
    collection: '长城栖居·乡居慢享',
    spotName: '福禄居农家院',
    location: '距离大境门约2.8公里,桥东区五一东大街',
    images: ['/home/fuluju1.jpg', '/home/fuluju2.jpg', '/home/fuluju3.jpg', '/home/fuluju4.jpg', '/home/fuluju5.jpg', '/home/fuluju6.jpg'],
    detailedIntroduction: '充满怀旧乡土气息的农家院落，店内保留老北方土炕包间，木桌花布，氛围感浓厚。食材大多取自本地菜园，主打坝上农家菜，烤羊排、莜面系列都是招牌。可聚餐歇脚，沉浸式感受长城脚下的乡村烟火。',
    highlights: ['小院体验','乡土家常菜'],
    scenicName: ''
  },
  {
    id: 2,
    collection: '长城栖居·乡居慢享',
    spotName: '新农村农家院',
    location: '距离张家口大境门15公里,桥西区滨河南路', 
    images: ['/home/xinnongcun1.jpg', '/home/xinnongcun2.jpg', '/home/xinnongcun3.jpg'],
    detailedIntroduction: '充满年代感主题农家大院，复古窑洞包间、红灯笼长廊，氛围感十足。主打张家口本地家常饭菜，分量足、价格实惠。可以多人聚餐、团建，沉浸式感受怀旧乡土风情，逛完长城来这里歇脚吃饭。',
    highlights: ['怀旧主题｜农家家常菜｜适合团建'],
    scenicName: ''
  },
  {
    id: 3,
    collection: '长城栖居·乡居慢享',
    spotName: '沐野田涧农家院',
    location: '距离张家口大境门15公里,桥西区姚家房镇王安房村',
    images: ['/home/muye1.jpg', '/home/muye2.jpg', '/home/muye3.jpg', '/home/muye4.jpg'],
    detailedIntroduction: '田园风露营小院，树林间搭着精致帐篷，夜晚挂满星星串灯，氛围感拉满。小院自带柴火灶，可以亲手炖菜、烧烤。还有网红热气球打卡点，适合休闲野餐、朋友小聚、亲子游玩。白天看田园风光，夜晚伴着星光闲谈，感受乡村浪漫。',
    highlights: ['露营体验｜柴火美食｜网红打卡'],
    scenicName: ''
  },
]

function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [current, setCurrent] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)

  const go = useCallback((dir: number) => {
    setCurrent(prev => {
      const next = prev + dir
      if (next < 0) return images.length - 1
      if (next >= images.length) return 0
      return next
    })
  }, [images.length])

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = startX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      go(diff > 0 ? 1 : -1)
    }
  }

  return (
    <div className="spot-page__image-wrap">
      <div
        className="spot-page__carousel-track"
        ref={trackRef}
        style={{ transform: `translateX(-${current * 100}%)` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((src, i) => (
          <img key={i} className="spot-page__image" src={src} alt={`${alt} - ${i + 1}`} />
        ))}
      </div>
      <button className="spot-page__carousel-btn spot-page__carousel-btn--prev" onClick={() => go(-1)} aria-label="上一张">
        ‹
      </button>
      <button className="spot-page__carousel-btn spot-page__carousel-btn--next" onClick={() => go(1)} aria-label="下一张">
        ›
      </button>
      <div className="spot-page__carousel-dots">
        {images.map((_, i) => (
          <button
            key={i}
            className={`spot-page__carousel-dot ${i === current ? 'spot-page__carousel-dot--active' : ''}`}
            onClick={() => setCurrent(i)}
            aria-label={`第${i + 1}张`}
          />
        ))}
      </div>
    </div>
  )
}

export function SpotRecommendPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const collectionTitle = searchParams.get('collectionTitle')?.trim()

  const spots = collectionTitle
    ? ALL_SPOTS.filter(s => s.collection === collectionTitle)
    : ALL_SPOTS

  const eyebrowMap: Record<string, string> = {
    '镜门寻迹·红韵乡途': 'SCENIC SPOTS',
    '张垣风物·助农优品': 'LOCAL PRODUCTS',
    '长城栖居·乡居慢享': 'VILLAGE LIFE',
  }

  const descMap: Record<string, string> = {
    '镜门寻迹·红韵乡途': '寻访镜门文脉，共赏红韵乡光。',
    '张垣风物·助农优品': '挖掘张垣好物，助力乡村振兴',
    '长城栖居·乡居慢享': '乡居不只是生活，更是一种向往',
  }

  return (
    <main className="page-shell">
      <section className="page-content">
        <div className="spot-page">
          <div className="spot-page__header">
            <button className="spot-page__back" onClick={() => navigate('/home')}>
              <span aria-hidden="true">←</span> 返回首页
            </button>
            <p className="spot-page__eyebrow">{eyebrowMap[collectionTitle || ''] || 'SCENIC SPOTS'}</p>
            <h1>{collectionTitle || '景点导览'}</h1>
            <p>{descMap[collectionTitle || ''] || '在这里浏览景区景点介绍。'}</p>
          </div>

          <div className="spot-page__grid">
            {spots.map((spot) => (
              <article key={spot.id} className="spot-page__card">
                <ImageCarousel images={spot.images} alt={spot.spotName} />
                <div className="spot-page__card-body">
                  <p className="spot-page__scenic-name">{spot.scenicName}</p>
                  <h2>📍 {spot.spotName.replace(' ', '')}</h2>
                  {spot.location && <p className="spot-page__location">{spot.location}</p>}
                  {spot.detailedIntroduction && <p className="spot-page__description">{spot.detailedIntroduction}</p>}
                  {spot.highlights.length > 0 && (
                    <div className="spot-page__highlights">
                      <span className="spot-page__highlights-label"></span>
                      <div className="spot-page__highlights-tags">
                        {spot.highlights.map((h, i) => (
                          <span key={i} className="spot-page__highlight-tag">{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
