// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()

const rp = require('request-promise')

const URL = "http://mobilecdnbj.kugou.com/api/v5/special/recommend?recommend_expire=0&sign=52186982747e1404d426fa3f2a1e8ee4&plat=0&uid=0&version=9108&page=1&area_code=1&appid=1005&mid=286974383886022203545511837994020015101&_t=1545746286"

const playlistCollection = db.collection("playlist")

const MAX_LIMIT = 1000

// 云函数入口函数
exports.main = async (event, context) => {
/*   const dbList = await playlistCollection.get()//获取云数据库数据 */
  const countResult = await playlistCollection.count()//异步操作计算数据总的条数,.count()返回的是对象
  const total = countResult.total//total取到总的条数这个数字
  const batchTimes = Math.ceil(total / MAX_LIMIT)
  const tasks = []//用于存放每个promise对象
  for(let i = 0; i < batchTimes; i++){
    let promise = playlistCollection.skip(i * MAX_LIMIT).limit(MAX_LIMIT).get()
    tasks.push(promise)
  }

  let dbList = {
    data: []
  }
  if(tasks.length > 0){
    dbList = (await Promise.all(tasks)).reduce((acc, cur) => {
      return {
        data: acc.data.concat(cur.data),
      }
    })
  }

  const playlist = await rp(URL).then((res) => {//获取服务端数据
    return JSON.parse(res).data.list
  })

  const newData = []
  for(let i = 0,len1 = playlist.length; i < len1; i++){
    let flag = true//标志位，true表不重复
    for(let j = 0,len2 = dbList.data.length;j < len2; j++)
      if(playlist[i].specialid === dbList.data[j].specialid){
        flag = false
        break//重复则直接结束本次数据库的遍历
      }
      if(flag){
        newData.push(playlist[i])
      }
  }

  for(let i = 0,len = newData.length; i < len; i++){
    await playlistCollection.add({
      data:{
        ...newData[i],
        createTime: db.serverDate(),
      }
    }).then((res)=>{
      console.log("插入成功")
    }).catch((err)=>{
      console.error("插入失败")
    })
  }

  return newData.length
}