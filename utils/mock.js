const STORAGE_KEY = 'lost_found_mock_data'

const defaultData = {
  users: [],
  items: [],
  messages: [],
  conversations: {}
}

export const mock = {
  getData() {
    try {
      const data = uni.getStorageSync(STORAGE_KEY)
      return data ? JSON.parse(data) : defaultData
    } catch (e) {
      return defaultData
    }
  },
  
  saveData(data) {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(data))
  },
  
  register(studentId, name, phone, password, avatar = '', className = '') {
    const data = this.getData()
    const exists = data.users.some(u => u.studentId === studentId)
    if (exists) {
      throw new Error('该学号已被注册')
    }
    
    const newUser = {
      id: Date.now().toString(),
      studentId,
      name,
      phone,
      password,
      avatar,
      className
    }
    
    data.users.push(newUser)
    this.saveData(data)
    
    return {
      user: newUser,
      token: `token_${newUser.id}`
    }
  },
  
  login(studentId, password) {
    const data = this.getData()
    const user = data.users.find(u => u.studentId === studentId && u.password === password)
    if (!user) {
      throw new Error('学号或密码错误')
    }
    
    return {
      user,
      token: `token_${user.id}`
    }
  },
  
  getUserInfo(userId) {
    const data = this.getData()
    return data.users.find(u => u.id === userId) || null
  },
  
  getItems(params = {}) {
    const data = this.getData()
    let items = [...data.items]
    
    if (params.type && params.type !== 'all') {
      items = items.filter(item => item.type === params.type)
    }
    
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase()
      items = items.filter(item => 
        item.title.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword)
      )
    }
    
    items.sort((a, b) => b.createdAt - a.createdAt)
    
    const start = (params.page - 1) * params.pageSize
    const end = start + params.pageSize
    
    return {
      data: items.slice(start, end),
      total: items.length
    }
  },
  
  getItem(id) {
    const data = this.getData()
    const item = data.items.find(i => i.id === id)
    if (!item) {
      throw new Error('物品不存在')
    }
    
    const user = data.users.find(u => u.id === item.userId)
    
    return {
      data: { ...item, user }
    }
  },
  
  createItem(itemData) {
    const data = this.getData()
    const newItem = {
      id: Date.now().toString(),
      ...itemData,
      createdAt: Date.now()
    }
    
    data.items.unshift(newItem)
    this.saveData(data)
    
    return { success: true }
  },
  
  getMessages() {
    const data = this.getData()
    return { data: data.messages }
  },
  
  getConversation(userId) {
    const data = this.getData()
    const conversation = data.conversations[userId] || []
    return { data: conversation }
  },
  
  sendMessage(userId, content) {
    const data = this.getData()
    
    if (!data.conversations[userId]) {
      data.conversations[userId] = []
    }
    
    const newMsg = {
      id: Date.now().toString(),
      senderId: 'current_user',
      content,
      createdAt: Date.now()
    }
    
    data.conversations[userId].push(newMsg)
    
    const msgIndex = data.messages.findIndex(m => m.userId === userId)
    if (msgIndex !== -1) {
      data.messages[msgIndex].lastMessage = content
      data.messages[msgIndex].lastTime = Date.now()
    }
    
    this.saveData(data)
    
    return { success: true }
  },
  
  uploadImage(filePath) {
    return Promise.resolve({
      url: `https://neeko-copilot.bytedance.net/api/text_to_image?prompt=lost%20item%20photo&image_size=landscape_4_3`
    })
  }
}