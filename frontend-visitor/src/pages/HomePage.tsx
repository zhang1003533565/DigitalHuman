import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './HomePage.css'
import { type SessionUser } from '../auth/session'
import { AsyncState } from '../components/AsyncState'
import { TripPlanner } from '../components/TripPlanner'

interface HomeItem {
  id: string
  type: string
  title: string
  imageUrl: string
  linkUrl: string
  description: string
  sortOrder: number
  enabled: boolean
}

interface HomeData {
  banners: HomeItem[]
  ads: HomeItem[]
  spotRecommends: HomeItem[]
  routeRecommends: HomeItem[]
}

type HomePageProps = {
  user: SessionUser
}

const EMPTY_HOME_DATA: HomeData = {
  banners: [],
  ads: [],
  spotRecommends: [],
  routeRecommends: [],
}

const FIRST_SPOT_MAP: Record<string, { title: string; imageUrl: string; description: string; address: string; tags: string[] }> = {
  '镜门寻迹·红韵乡途': {
    title: '大境门长城',
    imageUrl: '/home/dajingmengchangcheng1.jpg',
    description: '作为张家口城市象征，门楣"大好河山"气势雄浑，既是明清长城重要关隘、昔日张库大道的商贸起点，也见证了察哈尔地区近代革命风云；从这里出发，可沿古道深入周边村落，开启长城文化与红色乡土交织的乡野旅程',
    address: '河北省张家口市桥西区大境门景区',
    tags: ['万里长城第一门', '张库大道起点'],
  },
  '张垣风物·助农优品': {
    title: '口蘑干',
    imageUrl: '/home/koumogan1.jpg',
    description: '张家口坝上草原特产口蘑干，肉质厚实鲜香，自古便是塞外名珍。当地打造标准化采摘、烘干加工产业链，依托文旅电商拓宽销路，带动农户增收。小小的山珍走出乡村，将坝上生态资源转化为经济收益，助力乡村特色产业振兴。',
    address: '张家口市坝上地区',
    tags: ['有机认证', '助农产品'],
  },
  '长城栖居·乡居慢享': {
    title: '大境门古堡民宿',
    imageUrl: '/home/fuluju1.jpg',
    description: '充满怀旧乡土气息的农家院落，店内保留老北方土炕包间，木桌花布，氛围感浓厚。食材大多取自本地菜园，主打坝上农家菜，烤羊排、莜面系列都是招牌。可聚餐歇脚，沉浸式感受长城脚下的乡村烟火。',
    address: '张家口市大境门附近',
    tags: ['古堡民宿', '长城日出'],
  },
}

/** 首页"大境门下·乡旅新章"三个分类卡片 —— 前端硬编码，不依赖数据库 */
const HARDCODED_COLLECTIONS = [
  {
    id: 'collection-1',
    title: '镜门寻迹·红韵乡途',
    imageUrl: '/home/dajingmen_hongyun.jpg',
  },
  {
    id: 'collection-2',
    title: '张垣风物·助农优品',
    imageUrl: '/home/farm_harvest.jpg',
  },
  {
    id: 'collection-3',
    title: '长城栖居·乡居慢享',
    imageUrl: '/home/great_wall_village.jpg',
  },
]

function normalizeHomeData(data: Partial<HomeData>): HomeData {
  return {
    banners: data.banners ?? [],
    ads: data.ads ?? [],
    spotRecommends: data.spotRecommends ?? [],
    routeRecommends: data.routeRecommends ?? [],
  }
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return '早上好'
  if (hour >= 11 && hour < 13) return '中午好'
  if (hour >= 13 && hour < 18) return '下午好'
  if (hour >= 18 && hour < 22) return '晚上好'
  return '夜深了'
}

export function HomePage({ user }: HomePageProps) {
  const navigate = useNavigate()
  const [homeData, setHomeData] = useState<HomeData>(EMPTY_HOME_DATA)
  const [isLoading, setIsLoading] = useState(true)
  const [homeError, setHomeError] = useState<string | null>(null)
  const displayName = user.displayName || user.username
  const greeting = getGreeting()

  useEffect(() => {
    fetch('/api/home')
      .then((response) => {
        if (!response.ok) throw new Error('首页内容加载失败，请稍后重试。')
        return response.json() as Promise<Partial<HomeData>>
      })
      .then((data) => setHomeData(normalizeHomeData(data)))
      .catch(() => setHomeError('首页内容加载失败，请稍后重试。'))
      .finally(() => setIsLoading(false))
  }, [])

  const hasHomeContent = Object.values(homeData).some((items) => items.length > 0)
  const heroImage = '/home/hero-dajingmen.png?v=2'

  return (
    <main className="page-shell home-page">

      <div className="hp-scroll">
        <section className="hp-hero" aria-labelledby="home-hero-title">
          {heroImage && <img className="hp-hero__background" src={heroImage} alt={homeData.banners?.[0]?.title || "张家口大境门"} />}
          <div className="hp-hero__shade" />
          <div className="hp-hero__content">
            <p className="hp-hero__greeting">{greeting}，{displayName}</p>
            <h1 id="home-hero-title">今天，想怎样游<span>张家口大境门</span>？</h1>
            <TripPlanner 
              onPlanned={(routeId) => navigate(`/routes?plan=${encodeURIComponent(routeId)}`)}
              onNavigateMap={() => navigate('/map')}
            />
          </div>
          <div className="hp-guide" aria-label="AI 数字人导游">
            <p>告诉我你的偏好，<br />我来安排</p>
            <img src="/home/ai-guide-robot.png?v=2" alt="灵山 AI 数字人导游" />
          </div>
        </section>

        <section className="hp-section" aria-labelledby="inspiration-title">
            <div className="hp-section__title"><span /><h2 id="inspiration-title">大境门下·乡旅新章</h2></div>
            <div className="hp-inspiration">
              {HARDCODED_COLLECTIONS.map((item) => {
                const firstSpot = FIRST_SPOT_MAP[item.title]
                return (
                  <div key={item.id} className="hp-inspiration__card">
                    <button
                      className="hp-inspiration__item"
                      onClick={() => navigate(`/spot-recommend?collectionTitle=${encodeURIComponent(item.title)}`)}
                    >
                      {item.imageUrl && <img src={item.imageUrl} alt={item.title} />}
                      <span>{item.title}</span>
                      <span className="hp-inspiration__detail-btn">查看详情</span>
                    </button>
                    {firstSpot && (
                      <button
                        className="hp-inspiration__child"
                        onClick={() => navigate(`/spot-recommend?collectionTitle=${encodeURIComponent(item.title)}`)}
                      >
                        <div className="hp-inspiration__child-info">
                          <strong>{firstSpot.title}</strong>
                          {firstSpot.imageUrl && <img src={firstSpot.imageUrl} alt={firstSpot.title} />}
                          {firstSpot.description && (
                            <small>
                              {(() => {
                                const firstPeriod = firstSpot.description.indexOf('。')
                                if (firstPeriod > 0) {
                                  return (
                                    <>
                                      <span className="hp-product-card__lead">{firstSpot.description.slice(0, firstPeriod + 1)}</span>
                                      {firstSpot.description.slice(firstPeriod + 1)}
                                    </>
                                  )
                                }
                                return firstSpot.description
                              })()}
                            </small>
                          )}
                        </div>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="hp-section hp-route-section" aria-labelledby="route-title">
            <div className="hp-section__title"><span /><h2 id="route-title">乡旅小站</h2></div>
            <AsyncState isLoading={isLoading} error={homeError} isEmpty={homeData.routeRecommends.length === 0 && homeData.ads.length === 0} emptyMessage="暂无运营路线推荐，可先使用快捷规划。">
              <div className="hp-route-grid">
                {homeData.routeRecommends.map((item) => (
                  <button key={item.id} className="hp-route-card" onClick={() => navigate(item.linkUrl || '/routes')}>
                    <div className="hp-route-card__intro">
                      {item.imageUrl && <div className="hp-route-card__thumb"><img src={item.imageUrl} alt="" /></div>}
                      <div><strong>{item.title}</strong><span className="hp-route-card__badge">官方推荐</span></div>
                    </div>
                    {item.description && <span className="hp-route-card__description">{item.description}</span>}
                  </button>
                ))}
                {homeData.ads.map((item) => (
                  <button key={item.id} className="hp-show-card" title={item.description} onClick={() => navigate(item.linkUrl || '/tips')}>
                    {item.imageUrl && <img src={item.imageUrl} alt="" />}
                    <strong>{item.title}</strong><span aria-hidden="true">查看</span>
                  </button>
                ))}
              </div>
            </AsyncState>
          </section>

          <section className="hp-section hp-products-section">
            <div className="hp-products-grid">
              <div className="hp-products-row">
                <div className="hp-product-card">
                  <div className="hp-product-card__info">
                    <strong>阳原鹦哥绿豆</strong>
                    <img src="/home/yangyuan.jpg" alt="阳原鹦哥绿豆" />
                    <small><span className="hp-product-card__lead">阳原特产鹦哥绿豆，色泽翠绿鲜亮，颗粒饱满，易煮软烂。</span>当地规模化种植杂粮，打造绿色农产品基地，发展杂粮深加工，通过乡村旅游和电商渠道外销，让小豆子成为农户稳定增收产业，助力乡村产业振兴。</small>
                  </div>
                </div>
                <div className="hp-product-card">
                  <div className="hp-product-card__info">
                    <strong>怀来马奶葡萄</strong>
                    <img src="/home/putao.jpg" alt="怀来马奶葡萄" />
                    <small><span className="hp-product-card__lead">怀来河谷地带盛产马奶葡萄，果粒饱满、汁水清甜，是经典塞外鲜果。</span>当地发展葡萄种植与葡萄酒加工产业链，依托文旅采摘拓展销路，带动周边村民就业，把特色林果资源转化为乡村富民收益。</small>
                  </div>
                </div>
                <div className="hp-product-card">
                  <div className="hp-product-card__info">
                    <strong>坝上藜麦</strong>
                    <img src="/home/limai.jpg" alt="坝上藜麦" />
                    <small><span className="hp-product-card__lead">坝上高原冷凉环境孕育优质麦，富含多种营养，适合轻食膳食。</span>村庄集中连片种植藜麦，搭建标准化加工车间，线上线下同步销售，挖掘高寒土地价值，推动坝上特色杂粮产业发展，赋能乡村振兴。</small>
                  </div>
                </div>
              </div>
              <div className="hp-products-row">
                <div className="hp-product-card">
                  <div className="hp-product-card__info">
                    <strong>蔚县豆腐干</strong>
                    <img src="/home/doufu.jpg" alt="蔚县豆腐干" />
                    <small><span className="hp-product-card__lead">暖泉古镇传统手工豆腐干，古法卤制，咸香紧实有嚼劲。</span>扶持乡村手工作坊，传承百年卤制手艺，结合古镇旅游展销产品，带动留守妇女就业，让传统小吃变成乡村增收的特色产业。</small>
                  </div>
                </div>
                <div className="hp-product-card">
                  <div className="hp-product-card__info">
                    <strong>坝上沙棘果干</strong>
                    <img src="/home/shaqie.jpg" alt="坝上沙棘果干" />
                    <small><span className="hp-product-card__lead">张家口山野沙棘采摘后自然烘干，果香浓郁，富含维生素。</span>当地治理荒山、规模化种植沙棘，就地加工果干、饮品，把荒坡变成经济林，以生态林果产业带动村民增收，实现生态与富民双赢。</small>
                  </div>
                </div>
                <div className="hp-product-card">
                  <div className="hp-product-card__info">
                    <strong>万全糯玉米</strong>
                    <img src="/home/maicai.jpg" alt="万全糯玉米" />
                    <small><span className="hp-product-card__lead">万全地理标志糯玉米，昼夜温差积累糖分，口感软糯香甜。</span>乡村发展订单式种植，真空锁鲜加工，借助旅游平台带货，延长玉米产业链，让一穗穗糯玉米成为村民致富的"黄金作物"。</small>
                  </div>
                </div>
              </div>
              <div className="hp-products-row">
                <div className="hp-product-card">
                  <div className="hp-product-card__info">
                    <strong>蔚县剪纸冰箱贴</strong>
                    <img src="/home/jianzhi.jpg" alt="蔚县剪纸" />
                    <small><span className="hp-product-card__lead">源自联合国非遗蔚县剪纸，将长城、古堡纹样做成小巧冰箱贴，色彩鲜活。</span>乡村非遗工坊吸纳村民学习剪纸技艺，开发轻量化文创产品，依托游客消费，传承民间手艺，拓宽乡村文化增收渠道。</small>
                  </div>
                </div>
                <div className="hp-product-card">
                  <div className="hp-product-card__info">
                    <strong>泥河湾地层纪念瓶</strong>
                    <img src="/home/nihewan.jpg" alt="泥河湾地层纪念瓶" />
                    <small><span className="hp-product-card__lead">泥河湾远古文化主题文创瓶，复刻地层剖面，记录远古地质故事。</span>本地文创工作室带动乡村青年参与制作，挖掘远古文化 IP，把地质历史转化为文旅商品，带动乡村文化产业发展。</small>
                  </div>
                </div>
                <div className="hp-product-card">
                  <div className="hp-product-card__info">
                    <strong>大境门方言搪瓷杯</strong>
                    <img src="/home/dajingmen.jpg" alt="大境门方言搪瓷杯" />  
                    <small><span className="hp-product-card__lead">印有张家口本土方言和大境门简笔画，复古搪瓷杯实用耐看。</span>由乡村工坊加工制作，融合长城文化与本地烟火语言，借助旅游商城售卖，传播山城本土文化，带动乡村手工订单。</small>
                  </div>
                </div>
                <div className="hp-product-card">
                  <div className="hp-product-card__info">
                    <strong>张氏蛋雕小摆件</strong>
                    <img src="/home/danji.jpg" alt="张氏蛋雕小摆件" />
                    <small><span className="hp-product-card__lead">张家口非遗蛋雕作品，在蛋壳上雕刻大好河山、古堡图案，精巧别致。</span>扶持乡村非遗手艺人，开发小型便携蛋雕文创，在文旅商城售卖，传承小众雕刻技艺，以非遗文创带动村民增收。</small>
                  </div>
                </div>
              </div>
            </div>
          </section>
      </div>
    </main>
  )
}
