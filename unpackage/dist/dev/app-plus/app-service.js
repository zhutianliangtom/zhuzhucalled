if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  const USER_KEY = "lost_and_found_user";
  const TOKEN_KEY = "lost_and_found_token";
  const SETTINGS_KEY = "lost_and_found_settings";
  const storage = {
    setUser(user) {
      uni.setStorageSync(USER_KEY, JSON.stringify(user));
    },
    getUser() {
      try {
        const data = uni.getStorageSync(USER_KEY);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        return null;
      }
    },
    setToken(token) {
      uni.setStorageSync(TOKEN_KEY, token);
    },
    getToken() {
      try {
        const token = uni.getStorageSync(TOKEN_KEY);
        return token || "";
      } catch (e) {
        return "";
      }
    },
    clearUser() {
      uni.removeStorageSync(USER_KEY);
      uni.removeStorageSync(TOKEN_KEY);
    },
    setSettings(settings) {
      uni.setStorageSync(SETTINGS_KEY, JSON.stringify(settings));
    },
    getSettings() {
      try {
        const data = uni.getStorageSync(SETTINGS_KEY);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        return null;
      }
    }
  };
  const baseUrl = "http://183.66.27.20:41412";
  let heartbeatTimer = null;
  let isOnline = true;
  let heartbeatFailCount = 0;
  const MAX_FAIL_COUNT = 3;
  let offlineBannerTimer = null;
  const showOfflineBanner = () => {
    formatAppLog("log", "at utils/api.js:14", "🔴 显示断网提示");
    if (offlineBannerTimer) {
      clearTimeout(offlineBannerTimer);
    }
    try {
      uni.showToast({
        title: "⚠️ 无法连接服务器",
        icon: "none",
        duration: 999999,
        // 持久显示
        mask: false
      });
      formatAppLog("log", "at utils/api.js:29", "✅ Toast已调用");
    } catch (e) {
      formatAppLog("error", "at utils/api.js:31", "显示Toast失败:", e);
    }
    offlineBannerTimer = setTimeout(() => {
      showOfflineBanner();
    }, 5e3);
  };
  const hideOfflineBanner = () => {
    formatAppLog("log", "at utils/api.js:42", "🟢 隐藏断网提示");
    if (offlineBannerTimer) {
      clearTimeout(offlineBannerTimer);
      offlineBannerTimer = null;
    }
    try {
      uni.hideToast();
      formatAppLog("log", "at utils/api.js:52", "✅ Toast已隐藏");
    } catch (e) {
      formatAppLog("error", "at utils/api.js:54", "隐藏Toast失败:", e);
    }
  };
  const showOnlineToast = () => {
    try {
      uni.showToast({
        title: "✅ 网络已恢复",
        icon: "success",
        duration: 2e3
      });
      formatAppLog("log", "at utils/api.js:66", "✅ 网络恢复提示已显示");
    } catch (e) {
      formatAppLog("error", "at utils/api.js:68", "显示恢复提示失败:", e);
    }
  };
  const api = {
    // 启动心跳检测
    startHeartbeat() {
      if (heartbeatTimer) {
        formatAppLog("log", "at utils/api.js:76", "心跳检测已在运行");
        return;
      }
      formatAppLog("log", "at utils/api.js:80", "启动15秒心跳检测...");
      this.checkHeartbeat();
      heartbeatTimer = setInterval(() => {
        this.checkHeartbeat();
      }, 15e3);
    },
    // 执行单次心跳检测
    async checkHeartbeat() {
      try {
        await this.request("/api/heartbeat", "GET", {}, {
          "X-Heartbeat": "true"
          // 标记为心跳请求
        });
        if (!isOnline) {
          formatAppLog("log", "at utils/api.js:101", "✅ 网络已恢复");
          hideOfflineBanner();
          showOnlineToast();
          uni.$emit("network-status-change", { isOnline: true });
        }
        heartbeatFailCount = 0;
        isOnline = true;
      } catch (error) {
        heartbeatFailCount++;
        const errorMsg = error.errMsg || error.message || "Unknown error";
        formatAppLog("warn", "at utils/api.js:112", `心跳检测失败 (${heartbeatFailCount}/${MAX_FAIL_COUNT})`, errorMsg);
        if (heartbeatFailCount >= MAX_FAIL_COUNT) {
          formatAppLog("error", "at utils/api.js:116", "连续心跳失败，显示断网提示");
          isOnline = false;
          showOfflineBanner();
          uni.$emit("network-status-change", { isOnline: false });
        }
      }
    },
    // 停止心跳检测
    stopHeartbeat() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        formatAppLog("log", "at utils/api.js:130", "心跳检测已停止");
      }
    },
    // 获取在线状态
    getOnlineStatus() {
      return isOnline;
    },
    // 重置心跳状态（用户登录时调用）
    resetHeartbeat() {
      heartbeatFailCount = 0;
      isOnline = true;
      this.stopHeartbeat();
      this.startHeartbeat();
    },
    async request(url, method = "GET", data = {}, header = {}) {
      const token = storage.getToken();
      const defaultHeader = {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : ""
      };
      return new Promise((resolve, reject) => {
        uni.request({
          url: baseUrl + url,
          method,
          data,
          header: { ...defaultHeader, ...header },
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data);
            } else if (res.statusCode === 401) {
              if (header["X-Heartbeat"] === "true") {
                reject(new Error("心跳检测失败"));
                return;
              }
              storage.clearUser();
              uni.reLaunch({ url: "/pages/auth/login" });
              reject(new Error("登录已过期"));
            } else {
              reject(new Error(res.data.message || "请求失败"));
            }
          },
          fail: (err) => {
            reject(err);
          }
        });
      });
    },
    async register(data) {
      return await this.request("/auth/register", "POST", data);
    },
    async login(data) {
      return await this.request("/auth/login", "POST", data);
    },
    async getUserInfo() {
      return await this.request("/user/info");
    },
    async updateUserInfo(data) {
      return await this.request("/user/info", "PUT", data);
    },
    async searchUsers(keyword) {
      return await this.request(`/user/search?keyword=${encodeURIComponent(keyword)}`);
    },
    async getItems(params = {}) {
      const query = Object.keys(params).filter((key) => params[key]).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join("&");
      return await this.request(`/items${query ? "?" + query : ""}`);
    },
    async getItem(id) {
      return await this.request(`/items/${id}`);
    },
    async createItem(data) {
      return await this.request("/items", "POST", data);
    },
    async updateItem(id, data) {
      return await this.request(`/items/${id}`, "PUT", data);
    },
    async deleteItem(id) {
      return await this.request(`/items/${id}`, "DELETE");
    },
    async solveItem(id) {
      return await this.request(`/items/${id}/solve`, "POST");
    },
    async getUserStats() {
      return await this.request("/user/stats");
    },
    async getStats() {
      return await this.request("/stats");
    },
    async getUserItems(params = {}) {
      const query = Object.keys(params).filter((key) => params[key]).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join("&");
      return await this.request(`/user/items${query ? "?" + query : ""}`);
    },
    async getMessages() {
      return await this.request("/messages");
    },
    async getUnreadCount() {
      return await this.request("/messages/unread/count");
    },
    async getConversation(userId) {
      return await this.request(`/messages/conversation/${userId}`);
    },
    // 标记对话已读（清除未读数）
    async markConversationRead(userId) {
      return await this.request(`/messages/conversation/${userId}/read`, "POST");
    },
    async sendMessage(userId, content, type = "text", mediaUrl = "") {
      return await this.request("/messages/send", "POST", { userId, content, type, mediaUrl });
    },
    async blockUser(userId) {
      return await this.request("/user/block", "POST", { userId });
    },
    async unblockUser(userId) {
      return await this.request("/user/unblock", "POST", { userId });
    },
    async getBlockedUsers() {
      return await this.request("/user/blocked");
    },
    async uploadImage(filePath) {
      return await new Promise((resolve, reject) => {
        const token = storage.getToken();
        uni.uploadFile({
          url: baseUrl + "/upload/image",
          filePath,
          name: "image",
          header: {
            "Authorization": token ? `Bearer ${token}` : ""
          },
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(res.data));
            } else {
              reject(new Error("上传失败"));
            }
          },
          fail: (err) => {
            reject(err);
          }
        });
      });
    },
    async uploadImages(filePaths) {
      const results = [];
      for (let filePath of filePaths) {
        const result = await this.uploadImage(filePath);
        results.push(result.url);
      }
      return { urls: results };
    },
    async recallMessage(messageId) {
      return await this.request(`/messages/${messageId}/recall`, "POST");
    },
    async uploadVideo(filePath) {
      return await new Promise((resolve, reject) => {
        const token = storage.getToken();
        uni.showLoading({ title: "上传中..." });
        uni.uploadFile({
          url: baseUrl + "/upload/video",
          filePath,
          name: "video",
          header: {
            "Authorization": token ? `Bearer ${token}` : ""
          },
          success: (res) => {
            uni.hideLoading();
            if (res.statusCode === 200) {
              resolve(JSON.parse(res.data));
            } else {
              reject(new Error("视频上传失败"));
            }
          },
          fail: (err) => {
            uni.hideLoading();
            reject(err);
          }
        });
      });
    }
  };
  const format = {
    formatTime(timestamp) {
      if (!timestamp)
        return "";
      const date = new Date(timestamp);
      const now = /* @__PURE__ */ new Date();
      const diff = now.getTime() - date.getTime();
      const minute = 60 * 1e3;
      const hour = 60 * minute;
      const day = 24 * hour;
      if (diff < minute) {
        return "刚刚";
      } else if (diff < hour) {
        return `${Math.floor(diff / minute)}分钟前`;
      } else if (diff < day) {
        return `${Math.floor(diff / hour)}小时前`;
      } else if (diff < 7 * day) {
        return `${Math.floor(diff / day)}天前`;
      } else {
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }
    },
    formatDate(date) {
      if (!date)
        return "";
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  };
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$f = {
    name: "OfflineBanner",
    data() {
      return {
        showOfflineBanner: false
      };
    },
    mounted() {
      uni.$on("network-status-change", this.handleNetworkChange);
    },
    beforeDestroy() {
      uni.$off("network-status-change", this.handleNetworkChange);
    },
    methods: {
      handleNetworkChange(data) {
        formatAppLog("log", "at components/OfflineBanner.vue:26", "OfflineBanner收到网络状态变化:", data);
        this.showOfflineBanner = !data.isOnline;
      }
    }
  };
  function _sfc_render$e(_ctx, _cache, $props, $setup, $data, $options) {
    return $data.showOfflineBanner ? (vue.openBlock(), vue.createElementBlock("view", {
      key: 0,
      class: "offline-banner"
    }, [
      vue.createElementVNode("text", { class: "offline-icon" }, "⚠️"),
      vue.createElementVNode("text", { class: "offline-text" }, "无法连接服务器")
    ])) : vue.createCommentVNode("v-if", true);
  }
  const OfflineBanner = /* @__PURE__ */ _export_sfc(_sfc_main$f, [["render", _sfc_render$e], ["__scopeId", "data-v-08db080e"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/components/OfflineBanner.vue"]]);
  const _sfc_main$e = {
    components: {
      OfflineBanner
    },
    data() {
      return {
        format,
        items: [],
        activeTab: "all",
        categoryTabs: [
          { label: "全部", value: "all" },
          { label: "寻物启事", value: "lost" },
          { label: "失物招领", value: "found" }
        ],
        activeTimeFilter: "all",
        timeFilters: [
          { label: "全部", value: "all" },
          { label: "今天", value: "day" },
          { label: "本周", value: "week" },
          { label: "本月", value: "month" }
        ],
        searchKeyword: "",
        showSearch: false,
        hotTags: ["手机", "校园卡", "钥匙", "钱包", "书本"],
        page: 1,
        pageSize: 10,
        loading: false,
        tabBarItems: [
          { pagePath: "/pages/index/index", text: "首页", icon: "🏠" },
          { pagePath: "/pages/message/index", text: "消息", icon: "💬" },
          { pagePath: "/pages/item/publish", text: "发布", icon: "+" },
          { pagePath: "/pages/user/index", text: "我的", icon: "👤" }
        ],
        currentTabBarIndex: 0,
        unreadTotal: 0,
        pollTimer: null
      };
    },
    onLoad() {
      this.loadItems();
    },
    onShow() {
      if (this.items.length === 0) {
        this.loadItems();
      }
      this.currentTabBarIndex = 0;
      this.checkLoginAndLoadUnread();
      this.startPoll();
    },
    onHide() {
      this.stopPoll();
    },
    methods: {
      getFullImageUrl(url) {
        if (!url)
          return "";
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return url;
        }
        const baseUrl2 = "http://183.66.27.20:41412";
        return baseUrl2 + url;
      },
      async loadItems() {
        if (this.loading)
          return;
        this.loading = true;
        try {
          const params = {
            page: this.page,
            pageSize: this.pageSize,
            type: this.activeTab === "all" ? "" : this.activeTab,
            keyword: this.searchKeyword,
            timeRange: this.activeTimeFilter
          };
          const res = await api.getItems(params);
          if (this.page === 1) {
            this.items = res.data;
          } else {
            this.items = [...this.items, ...res.data];
          }
        } catch (err) {
          formatAppLog("error", "at pages/index/index.vue:231", err);
        } finally {
          this.loading = false;
        }
      },
      handleTabChange(value) {
        this.activeTab = value;
        this.page = 1;
        this.items = [];
        this.loadItems();
      },
      handleTimeFilterChange(value) {
        this.activeTimeFilter = value;
        this.page = 1;
        this.items = [];
        this.loadItems();
      },
      handleSearch() {
        this.page = 1;
        this.items = [];
        this.showSearch = false;
        this.loadItems();
      },
      goDetail(id) {
        uni.navigateTo({ url: `/pages/item/detail?id=${id}` });
      },
      onReachBottom() {
        if (!this.loading) {
          this.page++;
          this.loadItems();
        }
      },
      switchTab(index) {
        if (index !== this.currentTabBarIndex) {
          this.currentTabBarIndex = index;
          uni.reLaunch({ url: this.tabBarItems[index].pagePath });
        }
      },
      handleTabClick(index) {
        this.switchTab(index);
      },
      // 检查登录状态并加载未读数
      checkLoginAndLoadUnread() {
        const token = storage.getToken();
        if (token) {
          this.loadUnreadCount();
        } else {
          this.unreadTotal = 0;
        }
      },
      // 加载未读数
      async loadUnreadCount() {
        try {
          const res = await api.getMessages();
          const total = res.data.reduce((s, c) => s + (c.unread || 0), 0);
          this.unreadTotal = total;
        } catch (err) {
          if (err.message !== "登录已过期") {
            formatAppLog("error", "at pages/index/index.vue:291", "获取未读数失败:", err);
          }
        }
      },
      // 轮询未读数
      startPoll() {
        this.stopPoll();
        this.pollTimer = setInterval(() => {
          const token = storage.getToken();
          if (token) {
            this.loadUnreadCount();
          }
        }, 3e3);
      },
      stopPoll() {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
      }
    }
  };
  function _sfc_render$d(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_offline_banner = vue.resolveComponent("offline-banner");
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createVNode(_component_offline_banner),
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("view", {
          class: "search-bar",
          onClick: _cache[0] || (_cache[0] = ($event) => $data.showSearch = true)
        }, [
          vue.createElementVNode("text", { class: "search-icon" }, "🔍"),
          vue.createElementVNode(
            "text",
            { class: "search-placeholder" },
            vue.toDisplayString($data.searchKeyword || "搜索丢失物品..."),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "tabs" }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.categoryTabs, (tab) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: tab.value,
              class: vue.normalizeClass(["tab-item", { active: $data.activeTab === tab.value }]),
              onClick: ($event) => $options.handleTabChange(tab.value)
            }, [
              vue.createElementVNode(
                "text",
                null,
                vue.toDisplayString(tab.label),
                1
                /* TEXT */
              )
            ], 10, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]),
      vue.createElementVNode("view", { class: "time-filter" }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.timeFilters, (filter) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: filter.value,
              class: vue.normalizeClass(["time-filter-item", { active: $data.activeTimeFilter === filter.value }]),
              onClick: ($event) => $options.handleTimeFilterChange(filter.value)
            }, [
              vue.createElementVNode(
                "text",
                null,
                vue.toDisplayString(filter.label),
                1
                /* TEXT */
              )
            ], 10, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]),
      vue.createElementVNode("view", { class: "content" }, [
        $data.items.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "empty"
        }, [
          vue.createElementVNode("text", { class: "empty-icon" }, "📦"),
          vue.createElementVNode("text", { class: "empty-text" }, "暂无相关物品")
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "item-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.items, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: item.id,
                class: "item-card",
                onClick: ($event) => $options.goDetail(item.id)
              }, [
                item.images && item.images.length > 0 ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 0,
                  class: "image-wrapper"
                }, [
                  vue.createElementVNode("view", { class: "image-container" }, [
                    (vue.openBlock(true), vue.createElementBlock(
                      vue.Fragment,
                      null,
                      vue.renderList(item.images.slice(0, 3), (img, idx) => {
                        return vue.openBlock(), vue.createElementBlock("image", {
                          key: idx,
                          src: $options.getFullImageUrl(img),
                          mode: "aspectFill",
                          class: "item-image"
                        }, null, 8, ["src"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    )),
                    item.images.length > 3 ? (vue.openBlock(), vue.createElementBlock("view", {
                      key: 0,
                      class: "image-count"
                    }, [
                      vue.createElementVNode(
                        "text",
                        null,
                        "+" + vue.toDisplayString(item.images.length - 3),
                        1
                        /* TEXT */
                      )
                    ])) : vue.createCommentVNode("v-if", true)
                  ])
                ])) : (vue.openBlock(), vue.createElementBlock("view", {
                  key: 1,
                  class: "image-wrapper"
                }, [
                  vue.createElementVNode("image", {
                    src: "https://neeko-copilot.bytedance.net/api/text_to_image?prompt=lost%20and%20found%20item&image_size=square",
                    mode: "aspectFill",
                    class: "item-image default-image"
                  }, null, 8, ["src"])
                ])),
                vue.createElementVNode("view", { class: "item-info" }, [
                  vue.createElementVNode("view", { class: "item-header" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "item-title" },
                      vue.toDisplayString(item.title),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      {
                        class: vue.normalizeClass(["item-tag", item.type])
                      },
                      vue.toDisplayString(item.type === "lost" ? "寻物" : "招领"),
                      3
                      /* TEXT, CLASS */
                    )
                  ]),
                  vue.createElementVNode(
                    "text",
                    { class: "item-desc" },
                    vue.toDisplayString(item.description),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("view", { class: "item-footer" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "item-time" },
                      vue.toDisplayString($data.format.formatTime(item.createdAt * 1e3)),
                      1
                      /* TEXT */
                    )
                  ])
                ])
              ], 8, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]))
      ]),
      $data.showSearch ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "search-modal",
        onClick: _cache[5] || (_cache[5] = ($event) => $data.showSearch = false)
      }, [
        vue.createElementVNode("view", {
          class: "search-content",
          onClick: _cache[4] || (_cache[4] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode("view", { class: "search-input-wrap" }, [
            vue.createElementVNode("text", { class: "search-icon" }, "🔍"),
            vue.withDirectives(vue.createElementVNode("input", {
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.searchKeyword = $event),
              type: "text",
              placeholder: "输入关键词搜索...",
              class: "search-input",
              focus: $data.showSearch,
              "confirm-type": "search",
              onConfirm: _cache[2] || (_cache[2] = (...args) => $options.handleSearch && $options.handleSearch(...args))
            }, null, 40, ["focus"]), [
              [vue.vModelText, $data.searchKeyword]
            ]),
            $data.searchKeyword ? (vue.openBlock(), vue.createElementBlock("text", {
              key: 0,
              class: "clear-btn",
              onClick: _cache[3] || (_cache[3] = ($event) => $data.searchKeyword = "")
            }, "✕")) : vue.createCommentVNode("v-if", true)
          ]),
          vue.createElementVNode("view", { class: "search-tags" }, [
            vue.createElementVNode("text", { class: "tags-title" }, "热门搜索"),
            vue.createElementVNode("view", { class: "tags-wrap" }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($data.hotTags, (tag) => {
                  return vue.openBlock(), vue.createElementBlock("text", {
                    key: tag,
                    class: "tag",
                    onClick: ($event) => {
                      $data.searchKeyword = tag;
                      $options.handleSearch();
                    }
                  }, vue.toDisplayString(tag), 9, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true),
      vue.createElementVNode("view", { class: "tabbar-container" }, [
        vue.createElementVNode("view", { class: "custom-tabbar" }, [
          vue.createElementVNode("view", { class: "tab-container" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.tabBarItems, (item, index) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: index,
                  class: vue.normalizeClass(["tab-bar-item", { active: $data.currentTabBarIndex === index }]),
                  onClick: ($event) => $options.handleTabClick(index)
                }, [
                  index === 1 && $data.unreadTotal > 0 ? (vue.openBlock(), vue.createElementBlock("view", {
                    key: 0,
                    class: "tab-badge"
                  }, [
                    vue.createElementVNode(
                      "text",
                      null,
                      vue.toDisplayString($data.unreadTotal > 99 ? "99+" : $data.unreadTotal),
                      1
                      /* TEXT */
                    )
                  ])) : vue.createCommentVNode("v-if", true),
                  vue.createElementVNode(
                    "text",
                    { class: "tab-icon" },
                    vue.toDisplayString(item.icon),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "tab-text" },
                    vue.toDisplayString(item.text),
                    1
                    /* TEXT */
                  )
                ], 10, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])
      ])
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$e, [["render", _sfc_render$d], ["__scopeId", "data-v-1cf27b2a"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/index/index.vue"]]);
  const _sfc_main$d = {
    data() {
      return {
        format,
        conversations: [],
        tabBarItems: [
          { pagePath: "/pages/index/index", text: "首页", icon: "🏠" },
          { pagePath: "/pages/message/index", text: "消息", icon: "💬" },
          { pagePath: "/pages/item/publish", text: "发布", icon: "+" },
          { pagePath: "/pages/user/index", text: "我的", icon: "👤" }
        ],
        currentTabBarIndex: 1,
        unreadTotal: 0,
        pollTimer: null,
        _notified: {}
      };
    },
    onLoad() {
      this.checkLoginAndLoad();
      this.startPoll();
    },
    onShow() {
      this.checkLoginAndLoad();
      this.updateBadge();
      this.currentTabBarIndex = 1;
    },
    onHide() {
      this.stopPoll();
    },
    onUnload() {
      this.stopPoll();
    },
    methods: {
      getFullImageUrl(url) {
        if (!url)
          return "";
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return url;
        }
        const baseUrl2 = "http://183.66.27.20:41412";
        return baseUrl2 + url;
      },
      // 检查登录状态并加载对话列表
      checkLoginAndLoad() {
        const token = storage.getToken();
        if (token) {
          this.loadConversations();
        } else {
          this.conversations = [];
          this.unreadTotal = 0;
        }
      },
      async loadConversations() {
        try {
          this._notified = {};
          const res = await api.getMessages();
          this.conversations = res.data || [];
          this.updateUnreadTotal();
        } catch (err) {
          if (err.message !== "登录已过期") {
            formatAppLog("error", "at pages/message/index.vue:129", err);
          }
        }
      },
      // 轮询：每 3 秒刷新一次
      startPoll() {
        this.stopPoll();
        this.pollTimer = setInterval(() => {
          const token = storage.getToken();
          if (token) {
            this.loadConversations();
          }
        }, 3e3);
      },
      stopPoll() {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
      },
      // 更新未读总数 + Android 角标
      updateUnreadTotal() {
        const total = this.conversations.reduce((s, c) => s + (c.unread || 0), 0);
        this.unreadTotal = total;
        this.updateBadge();
        this.conversations.forEach((c) => {
          if (c.unread > 0 && !this._notified[c.userId]) {
            this._notified[c.userId] = true;
            this.showLocalNotification(c);
          }
        });
      },
      // Android 原生角标 + 本地通知
      updateBadge() {
        const total = this.unreadTotal;
        if (typeof plus !== "undefined" && plus.runtime) {
          plus.runtime.setBadgeNumber(total);
          if (total > 0) {
            this.showLocalNotification(total);
          } else {
            if (typeof plus !== "undefined" && plus.push) {
              plus.push.clear();
            }
          }
        }
      },
      showLocalNotification(conversation) {
        if (typeof plus === "undefined" || !plus.push)
          return;
        const payload = JSON.stringify({
          userId: conversation.userId,
          userName: conversation.userName
        });
        plus.push.createMessage(
          `来自 ${conversation.userName} 的新消息`,
          conversation.lastMessage || "点击查看",
          {
            title: "校园失物招领",
            payload,
            sound: "system",
            cover: false
          }
        );
      },
      goChat(userId, userName, userAvatar) {
        const encodedName = encodeURIComponent(userName || "未知用户");
        const avatar = userAvatar || "";
        uni.navigateTo({ url: `/pages/message/chat?userId=${userId}&userName=${encodedName}&userAvatar=${avatar}` });
      },
      switchTab(index) {
        if (index !== this.currentTabBarIndex) {
          this.currentTabBarIndex = index;
          uni.reLaunch({ url: this.tabBarItems[index].pagePath });
        }
      },
      handleTabClick(index) {
        this.switchTab(index);
      }
    }
  };
  function _sfc_render$c(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("text", { class: "title" }, "消息")
      ]),
      $data.conversations.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "empty"
      }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "💬"),
        vue.createElementVNode("text", { class: "empty-text" }, "暂无消息")
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "conversation-list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.conversations, (conv) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: conv.userId,
              class: "conversation-item",
              onClick: ($event) => $options.goChat(conv.userId, conv.userName, conv.userAvatar)
            }, [
              vue.createElementVNode("view", { class: "avatar" }, [
                conv.userAvatar ? (vue.openBlock(), vue.createElementBlock("image", {
                  key: 0,
                  src: $options.getFullImageUrl(conv.userAvatar),
                  mode: "aspectFill",
                  class: "avatar-img"
                }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock(
                  "text",
                  {
                    key: 1,
                    class: "avatar-text"
                  },
                  vue.toDisplayString((conv.userName || "?").charAt(0)),
                  1
                  /* TEXT */
                ))
              ]),
              vue.createElementVNode("view", { class: "conv-info" }, [
                vue.createElementVNode("view", { class: "conv-header" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "conv-name" },
                    vue.toDisplayString(conv.userName),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("view", { class: "header-right" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "conv-time" },
                      vue.toDisplayString($data.format.formatTime(conv.lastTime)),
                      1
                      /* TEXT */
                    ),
                    conv.unread > 0 ? (vue.openBlock(), vue.createElementBlock("view", {
                      key: 0,
                      class: "unread-badge"
                    }, [
                      vue.createElementVNode(
                        "text",
                        null,
                        vue.toDisplayString(conv.unread),
                        1
                        /* TEXT */
                      )
                    ])) : vue.createCommentVNode("v-if", true)
                  ])
                ]),
                vue.createElementVNode(
                  "text",
                  { class: "conv-preview" },
                  vue.toDisplayString(conv.lastMessage),
                  1
                  /* TEXT */
                )
              ])
            ], 8, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])),
      vue.createElementVNode("view", { class: "tabbar-container" }, [
        vue.createElementVNode("view", { class: "custom-tabbar" }, [
          vue.createElementVNode("view", { class: "tab-container" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.tabBarItems, (item, index) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: index,
                  class: vue.normalizeClass(["tab-bar-item", { active: $data.currentTabBarIndex === index }]),
                  onClick: ($event) => $options.handleTabClick(index)
                }, [
                  index === 1 && $data.unreadTotal > 0 ? (vue.openBlock(), vue.createElementBlock("view", {
                    key: 0,
                    class: "tab-badge"
                  }, [
                    vue.createElementVNode(
                      "text",
                      null,
                      vue.toDisplayString($data.unreadTotal > 99 ? "99+" : $data.unreadTotal),
                      1
                      /* TEXT */
                    )
                  ])) : vue.createCommentVNode("v-if", true),
                  vue.createElementVNode(
                    "text",
                    { class: "tab-icon" },
                    vue.toDisplayString(item.icon),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "tab-text" },
                    vue.toDisplayString(item.text),
                    1
                    /* TEXT */
                  )
                ], 10, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])
      ])
    ]);
  }
  const PagesMessageIndex = /* @__PURE__ */ _export_sfc(_sfc_main$d, [["render", _sfc_render$c], ["__scopeId", "data-v-780fc0ad"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/message/index.vue"]]);
  const _sfc_main$c = {
    data() {
      return {
        form: {
          type: "lost",
          title: "",
          description: "",
          images: [],
          contact: ""
        },
        tabBarItems: [
          { pagePath: "/pages/index/index", text: "首页", icon: "🏠" },
          { pagePath: "/pages/message/index", text: "消息", icon: "💬" },
          { pagePath: "/pages/item/publish", text: "发布", icon: "+" },
          { pagePath: "/pages/user/index", text: "我的", icon: "👤" }
        ],
        currentTabBarIndex: 2
      };
    },
    onShow() {
      const user = storage.getUser();
      if (user && user.phone) {
        this.form.contact = user.phone;
      }
      this.currentTabBarIndex = 2;
    },
    computed: {
      canSubmit() {
        return this.form.title && this.form.description && this.form.images.length > 0 && this.form.contact;
      }
    },
    methods: {
      chooseImage() {
        uni.showActionSheet({
          itemList: ["拍照", "从相册选择"],
          success: (res) => {
            const sourceType = res.tapIndex === 0 ? ["camera"] : ["album"];
            uni.chooseImage({
              count: 9 - this.form.images.length,
              sizeType: ["compressed"],
              sourceType,
              success: (res2) => {
                this.form.images = [...this.form.images, ...res2.tempFilePaths];
              },
              fail: (err) => {
                formatAppLog("error", "at pages/item/publish.vue:150", err);
              }
            });
          }
        });
      },
      removeImage(index) {
        this.form.images.splice(index, 1);
      },
      async handleSubmit() {
        const user = storage.getUser();
        if (!user) {
          uni.showModal({
            title: "提示",
            content: "请先登录后再发布物品",
            confirmText: "去登录",
            success: (res) => {
              if (res.confirm) {
                uni.navigateTo({ url: "/pages/auth/login" });
              }
            }
          });
          return;
        }
        if (!this.canSubmit)
          return;
        uni.showLoading({ title: "发布中..." });
        try {
          const imageUrls = [];
          formatAppLog("log", "at pages/item/publish.vue:180", "开始上传图片，数量:", this.form.images.length);
          for (let i = 0; i < this.form.images.length; i++) {
            const filePath = this.form.images[i];
            formatAppLog("log", "at pages/item/publish.vue:183", `上传第${i + 1}张图片:`, filePath);
            try {
              const res = await api.uploadImage(filePath);
              formatAppLog("log", "at pages/item/publish.vue:186", `第${i + 1}张图片上传成功:`, res.url);
              imageUrls.push(res.url);
            } catch (uploadErr) {
              formatAppLog("error", "at pages/item/publish.vue:189", `第${i + 1}张图片上传失败:`, uploadErr);
              throw new Error(`第${i + 1}张图片上传失败`);
            }
          }
          formatAppLog("log", "at pages/item/publish.vue:194", "所有图片上传完成，URL列表:", imageUrls);
          const data = {
            type: this.form.type,
            title: this.form.title,
            description: this.form.description,
            images: imageUrls,
            contact: this.form.contact
          };
          formatAppLog("log", "at pages/item/publish.vue:204", "提交物品数据:", data);
          await api.createItem(data);
          uni.hideLoading();
          uni.showToast({ title: "发布成功", icon: "success" });
          setTimeout(() => {
            uni.reLaunch({ url: "/pages/index/index" });
          }, 1500);
        } catch (err) {
          uni.hideLoading();
          formatAppLog("error", "at pages/item/publish.vue:216", "发布失败:", err);
          uni.showToast({ title: err.message || "发布失败", icon: "none" });
        }
      },
      switchTab(index) {
        if (index !== this.currentTabBarIndex) {
          this.currentTabBarIndex = index;
          uni.reLaunch({ url: this.tabBarItems[index].pagePath });
        }
      },
      handleTabClick(index) {
        this.switchTab(index);
      }
    }
  };
  function _sfc_render$b(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode(
          "text",
          { class: "title" },
          "发布" + vue.toDisplayString($data.form.type === "lost" ? "寻物启事" : "失物招领"),
          1
          /* TEXT */
        )
      ]),
      vue.createElementVNode("view", { class: "form" }, [
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "类型"),
          vue.createElementVNode("view", { class: "type-selector" }, [
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["type-option", { active: $data.form.type === "lost" }]),
                onClick: _cache[0] || (_cache[0] = ($event) => $data.form.type = "lost")
              },
              [
                vue.createElementVNode("text", null, "寻物启事")
              ],
              2
              /* CLASS */
            ),
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["type-option", { active: $data.form.type === "found" }]),
                onClick: _cache[1] || (_cache[1] = ($event) => $data.form.type = "found")
              },
              [
                vue.createElementVNode("text", null, "失物招领")
              ],
              2
              /* CLASS */
            )
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "物品名称"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.form.title = $event),
              type: "text",
              placeholder: "请输入物品名称",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.title]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "物品描述"),
          vue.withDirectives(vue.createElementVNode(
            "textarea",
            {
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.form.description = $event),
              placeholder: "请详细描述物品特征、丢失/发现地点等信息",
              class: "textarea",
              maxlength: 500
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.description]
          ]),
          vue.createElementVNode(
            "text",
            { class: "word-count" },
            vue.toDisplayString($data.form.description.length) + "/500",
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "上传图片"),
          vue.createElementVNode("view", { class: "image-upload" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.form.images, (img, index) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: index,
                  class: "image-item"
                }, [
                  vue.createElementVNode("image", {
                    src: img,
                    mode: "aspectFill",
                    class: "uploaded-image"
                  }, null, 8, ["src"]),
                  vue.createElementVNode("text", {
                    class: "remove-btn",
                    onClick: ($event) => $options.removeImage(index)
                  }, "✕", 8, ["onClick"])
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            )),
            $data.form.images.length < 9 ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "upload-btn",
              onClick: _cache[4] || (_cache[4] = (...args) => $options.chooseImage && $options.chooseImage(...args))
            }, [
              vue.createElementVNode("text", { class: "upload-icon" }, "+"),
              vue.createElementVNode("text", { class: "upload-text" }, "拍照/上传")
            ])) : vue.createCommentVNode("v-if", true)
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "联系方式"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $data.form.contact = $event),
              type: "text",
              placeholder: "请输入手机号或其他联系方式",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.contact]
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "footer" }, [
        vue.createElementVNode("button", {
          class: "submit-btn",
          disabled: !$options.canSubmit,
          onClick: _cache[6] || (_cache[6] = (...args) => $options.handleSubmit && $options.handleSubmit(...args))
        }, "发布", 8, ["disabled"])
      ]),
      vue.createElementVNode("view", { class: "tabbar-container" }, [
        vue.createElementVNode("view", { class: "custom-tabbar" }, [
          vue.createElementVNode("view", { class: "tab-container" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.tabBarItems, (item, index) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: index,
                  class: vue.normalizeClass(["tab-bar-item", { active: $data.currentTabBarIndex === index }]),
                  onClick: ($event) => $options.handleTabClick(index)
                }, [
                  vue.createElementVNode(
                    "text",
                    { class: "tab-icon" },
                    vue.toDisplayString(item.icon),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "tab-text" },
                    vue.toDisplayString(item.text),
                    1
                    /* TEXT */
                  )
                ], 10, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])
      ])
    ]);
  }
  const PagesItemPublish = /* @__PURE__ */ _export_sfc(_sfc_main$c, [["render", _sfc_render$b], ["__scopeId", "data-v-11d751c8"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/item/publish.vue"]]);
  const _sfc_main$b = {
    data() {
      return {
        user: null,
        stats: {
          lostCount: 0,
          foundCount: 0,
          solvedCount: 0,
          totalCount: 0
        },
        tabBarItems: [
          { pagePath: "/pages/index/index", text: "首页", icon: "🏠" },
          { pagePath: "/pages/message/index", text: "消息", icon: "💬" },
          { pagePath: "/pages/item/publish", text: "发布", icon: "+" },
          { pagePath: "/pages/user/index", text: "我的", icon: "👤" }
        ],
        currentTabBarIndex: 3
      };
    },
    onLoad() {
      this.loadUser();
    },
    onShow() {
      this.loadUser();
      this.loadStats();
      this.currentTabBarIndex = 3;
    },
    methods: {
      getFullImageUrl(url) {
        if (!url)
          return "";
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return url;
        }
        const baseUrl2 = "http://183.66.27.20:41412";
        return baseUrl2 + url;
      },
      loadUser() {
        this.user = storage.getUser();
      },
      async loadStats() {
        if (!this.user)
          return;
        try {
          const res = await api.getUserStats();
          const data = res.data || {};
          this.stats.lostCount = data.lostActive || data.lost || 0;
          this.stats.foundCount = data.foundActive || data.found || 0;
          this.stats.solvedCount = data.solved || 0;
          this.stats.totalCount = data.total || 0;
        } catch (err) {
          formatAppLog("error", "at pages/user/index.vue:179", "加载统计数据失败", err);
          await this.loadStatsFallback();
        }
      },
      async loadStatsFallback() {
        try {
          const res = await api.getUserItems({ type: "all", status: "all" });
          const items = res.data || [];
          this.stats.lostCount = items.filter((item) => item.type === "lost" && item.status === "active").length;
          this.stats.foundCount = items.filter((item) => item.type === "found" && item.status === "active").length;
          this.stats.solvedCount = items.filter((item) => item.status === "solved").length;
          this.stats.totalCount = items.length;
        } catch (err) {
          formatAppLog("error", "at pages/user/index.vue:193", "加载统计数据失败(备用)", err);
        }
      },
      chooseAvatar() {
        if (!this.user) {
          uni.showToast({ title: "请先登录", icon: "none" });
          return;
        }
        uni.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: async (res) => {
            const filePath = res.tempFilePaths[0];
            uni.showLoading({ title: "上传中..." });
            try {
              const result = await api.uploadImage(filePath);
              await api.updateUserInfo({ avatar: result.url });
              this.user.avatar = result.url;
              storage.setUser(this.user);
              uni.hideLoading();
              uni.showToast({ title: "头像更新成功", icon: "success" });
            } catch (err) {
              uni.hideLoading();
              uni.showToast({ title: "上传失败", icon: "none" });
            }
          }
        });
      },
      goLogin() {
        uni.navigateTo({ url: "/pages/auth/login" });
      },
      goEdit() {
        uni.navigateTo({ url: "/pages/user/edit" });
      },
      goMyItems(type, status = "active") {
        uni.navigateTo({ url: `/pages/user/my-items?type=${type}&status=${status}` });
      },
      goSettings() {
        uni.navigateTo({ url: "/pages/user/settings" });
      },
      goBlockedUsers() {
        uni.navigateTo({ url: "/pages/user/blocked-users" });
      },
      handleLogout() {
        uni.showModal({
          title: "确认退出",
          content: "确定要退出登录吗？",
          success: (res) => {
            if (res.confirm) {
              storage.clearUser();
              this.user = null;
              this.stats = { lostCount: 0, foundCount: 0, solvedCount: 0, totalCount: 0 };
              uni.showToast({ title: "退出成功", icon: "success" });
            }
          }
        });
      },
      switchTab(index) {
        if (index !== this.currentTabBarIndex) {
          this.currentTabBarIndex = index;
          uni.reLaunch({ url: this.tabBarItems[index].pagePath });
        }
      },
      handleTabClick(index) {
        this.switchTab(index);
      }
    }
  };
  function _sfc_render$a(_ctx, _cache, $props, $setup, $data, $options) {
    var _a, _b, _c, _d, _e, _f;
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "user-header" }, [
        vue.createElementVNode("view", {
          class: "avatar-wrapper",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.chooseAvatar && $options.chooseAvatar(...args))
        }, [
          ((_a = $data.user) == null ? void 0 : _a.avatar) ? (vue.openBlock(), vue.createElementBlock("image", {
            key: 0,
            src: $options.getFullImageUrl($data.user.avatar),
            class: "avatar"
          }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("view", {
            key: 1,
            class: "avatar"
          }, [
            vue.createElementVNode(
              "text",
              { class: "avatar-text" },
              vue.toDisplayString(((_c = (_b = $data.user) == null ? void 0 : _b.name) == null ? void 0 : _c.charAt(0)) || "?"),
              1
              /* TEXT */
            )
          ])),
          vue.createElementVNode("view", { class: "avatar-edit" }, [
            vue.createElementVNode("text", { class: "edit-icon" }, "📷")
          ])
        ]),
        vue.createElementVNode("view", { class: "user-info" }, [
          vue.createElementVNode(
            "text",
            { class: "user-name" },
            vue.toDisplayString(((_d = $data.user) == null ? void 0 : _d.name) || "点击登录"),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "user-class" },
            vue.toDisplayString(((_e = $data.user) == null ? void 0 : _e.className) || ((_f = $data.user) == null ? void 0 : _f.studentId)),
            1
            /* TEXT */
          )
        ]),
        $data.user ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "edit-btn",
          onClick: _cache[1] || (_cache[1] = (...args) => $options.goEdit && $options.goEdit(...args))
        }, [
          vue.createElementVNode("text", null, "编辑")
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "login-btn",
          onClick: _cache[2] || (_cache[2] = (...args) => $options.goLogin && $options.goLogin(...args))
        }, [
          vue.createElementVNode("text", null, "登录")
        ]))
      ]),
      $data.user ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "stats-section"
      }, [
        vue.createElementVNode("view", { class: "stat-item" }, [
          vue.createElementVNode(
            "text",
            { class: "stat-num" },
            vue.toDisplayString($data.stats.lostCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stat-label" }, "寻物启事")
        ]),
        vue.createElementVNode("view", { class: "stat-divider" }),
        vue.createElementVNode("view", { class: "stat-item" }, [
          vue.createElementVNode(
            "text",
            { class: "stat-num" },
            vue.toDisplayString($data.stats.foundCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stat-label" }, "失物招领")
        ]),
        vue.createElementVNode("view", { class: "stat-divider" }),
        vue.createElementVNode("view", { class: "stat-item" }, [
          vue.createElementVNode(
            "text",
            { class: "stat-num" },
            vue.toDisplayString($data.stats.solvedCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stat-label" }, "已解决")
        ]),
        vue.createElementVNode("view", { class: "stat-divider" }),
        vue.createElementVNode("view", { class: "stat-item" }, [
          vue.createElementVNode(
            "text",
            { class: "stat-num" },
            vue.toDisplayString($data.stats.totalCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stat-label" }, "总发布")
        ])
      ])) : vue.createCommentVNode("v-if", true),
      $data.user ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "menu-list"
      }, [
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[3] || (_cache[3] = ($event) => $options.goMyItems("all"))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "📦"),
          vue.createElementVNode("text", { class: "menu-text" }, "我的发布"),
          vue.createElementVNode(
            "text",
            { class: "menu-count" },
            vue.toDisplayString($data.stats.totalCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[4] || (_cache[4] = ($event) => $options.goMyItems("lost"))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "🔍"),
          vue.createElementVNode("text", { class: "menu-text" }, "寻物启事"),
          vue.createElementVNode(
            "text",
            { class: "menu-count" },
            vue.toDisplayString($data.stats.lostCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[5] || (_cache[5] = ($event) => $options.goMyItems("found"))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "✨"),
          vue.createElementVNode("text", { class: "menu-text" }, "失物招领"),
          vue.createElementVNode(
            "text",
            { class: "menu-count" },
            vue.toDisplayString($data.stats.foundCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[6] || (_cache[6] = ($event) => $options.goMyItems("all", "solved"))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "✓"),
          vue.createElementVNode("text", { class: "menu-text" }, "已解决"),
          vue.createElementVNode(
            "text",
            { class: "menu-count" },
            vue.toDisplayString($data.stats.solvedCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[7] || (_cache[7] = (...args) => $options.goSettings && $options.goSettings(...args))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "⚙️"),
          vue.createElementVNode("text", { class: "menu-text" }, "设置"),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[8] || (_cache[8] = (...args) => $options.goBlockedUsers && $options.goBlockedUsers(...args))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "🚫"),
          vue.createElementVNode("text", { class: "menu-text" }, "黑名单"),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "menu-item logout",
          onClick: _cache[9] || (_cache[9] = (...args) => $options.handleLogout && $options.handleLogout(...args))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "🚪"),
          vue.createElementVNode("text", { class: "menu-text" }, "退出登录"),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ])
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "guest-content"
      }, [
        vue.createElementVNode("view", { class: "guest-card" }, [
          vue.createElementVNode("text", { class: "guest-title" }, "欢迎使用校园失物招领"),
          vue.createElementVNode("text", { class: "guest-desc" }, "登录后可以发布物品、查看消息"),
          vue.createElementVNode("button", {
            class: "guest-btn",
            onClick: _cache[10] || (_cache[10] = (...args) => $options.goLogin && $options.goLogin(...args))
          }, "立即登录")
        ])
      ])),
      vue.createElementVNode("view", { class: "tabbar-container" }, [
        vue.createElementVNode("view", { class: "custom-tabbar" }, [
          vue.createElementVNode("view", { class: "tab-container" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.tabBarItems, (item, index) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: index,
                  class: vue.normalizeClass(["tab-bar-item", { active: $data.currentTabBarIndex === index }]),
                  onClick: ($event) => $options.handleTabClick(index)
                }, [
                  vue.createElementVNode(
                    "text",
                    { class: "tab-icon" },
                    vue.toDisplayString(item.icon),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "tab-text" },
                    vue.toDisplayString(item.text),
                    1
                    /* TEXT */
                  )
                ], 10, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])
      ])
    ]);
  }
  const PagesUserIndex = /* @__PURE__ */ _export_sfc(_sfc_main$b, [["render", _sfc_render$a], ["__scopeId", "data-v-79e6a490"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/user/index.vue"]]);
  const _sfc_main$a = {
    data() {
      return {
        form: {
          studentId: "",
          password: "",
          remember: false
        }
      };
    },
    computed: {
      canSubmit() {
        return this.form.studentId && this.form.password;
      }
    },
    methods: {
      async handleLogin() {
        if (!this.canSubmit)
          return;
        uni.showLoading({ title: "登录中..." });
        try {
          const res = await api.login({
            studentId: this.form.studentId,
            password: this.form.password
          });
          storage.setUser(res.user);
          storage.setToken(res.token);
          uni.hideLoading();
          uni.showToast({ title: "登录成功", icon: "success" });
          api.resetHeartbeat();
          setTimeout(() => {
            uni.reLaunch({ url: "/pages/index/index" });
          }, 1500);
        } catch (err) {
          uni.hideLoading();
          uni.showToast({ title: err.message || "登录失败", icon: "none" });
        }
      },
      goRegister() {
        uni.navigateTo({ url: "/pages/auth/register" });
      }
    }
  };
  function _sfc_render$9(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "logo" }, [
        vue.createElementVNode("view", { class: "logo-icon" }, [
          vue.createElementVNode("text", { class: "icon" }, "🔍")
        ]),
        vue.createElementVNode("text", { class: "logo-text" }, "校园失物招领")
      ]),
      vue.createElementVNode("view", { class: "form" }, [
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "学号"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.form.studentId = $event),
              type: "number",
              placeholder: "请输入学号",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.studentId]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "密码"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.form.password = $event),
              type: "password",
              placeholder: "请输入密码",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.password]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["checkbox", { checked: $data.form.remember }]),
              onClick: _cache[2] || (_cache[2] = ($event) => $data.form.remember = !$data.form.remember)
            },
            [
              $data.form.remember ? (vue.openBlock(), vue.createElementBlock("text", { key: 0 }, "✓")) : vue.createCommentVNode("v-if", true)
            ],
            2
            /* CLASS */
          ),
          vue.createElementVNode("text", { class: "checkbox-text" }, "记住我")
        ]),
        vue.createElementVNode("button", {
          class: "submit-btn",
          disabled: !$options.canSubmit,
          onClick: _cache[3] || (_cache[3] = (...args) => $options.handleLogin && $options.handleLogin(...args))
        }, "登录", 8, ["disabled"]),
        vue.createElementVNode("view", { class: "link-row" }, [
          vue.createElementVNode("text", {
            class: "link",
            onClick: _cache[4] || (_cache[4] = (...args) => $options.goRegister && $options.goRegister(...args))
          }, "还没有账号？立即注册")
        ])
      ])
    ]);
  }
  const PagesAuthLogin = /* @__PURE__ */ _export_sfc(_sfc_main$a, [["render", _sfc_render$9], ["__scopeId", "data-v-2cc9f8c3"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/auth/login.vue"]]);
  const _sfc_main$9 = {
    data() {
      return {
        form: {
          studentId: "",
          name: "",
          phone: "",
          className: "",
          password: "",
          confirmPassword: "",
          avatar: ""
        }
      };
    },
    computed: {
      canSubmit() {
        return this.form.studentId && this.form.name && this.form.phone && this.form.className && this.form.password && this.form.confirmPassword && this.form.password === this.form.confirmPassword;
      }
    },
    methods: {
      chooseAvatar() {
        uni.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: async (res) => {
            const filePath = res.tempFilePaths[0];
            uni.showLoading({ title: "上传中..." });
            try {
              const result = await api.uploadImage(filePath);
              this.form.avatar = result.url;
            } catch (err) {
              uni.showToast({ title: "上传失败", icon: "none" });
            }
            uni.hideLoading();
          }
        });
      },
      async handleRegister() {
        if (!this.canSubmit) {
          if (this.form.password !== this.form.confirmPassword) {
            uni.showToast({ title: "两次输入的密码不一致", icon: "none" });
          } else {
            uni.showToast({ title: "请填写完整信息", icon: "none" });
          }
          return;
        }
        uni.showLoading({ title: "注册中..." });
        try {
          await api.register({
            studentId: this.form.studentId,
            name: this.form.name,
            phone: this.form.phone,
            password: this.form.password,
            className: this.form.className,
            avatar: this.form.avatar
          });
          uni.hideLoading();
          uni.showToast({ title: "注册成功，请等待管理员审核", icon: "success" });
          setTimeout(() => {
            uni.navigateBack();
          }, 2e3);
        } catch (err) {
          uni.hideLoading();
          uni.showToast({ title: err.message || "注册失败", icon: "none" });
        }
      },
      goLogin() {
        uni.navigateBack();
      }
    }
  };
  function _sfc_render$8(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("text", { class: "title" }, "注册账号")
      ]),
      vue.createElementVNode("view", { class: "form" }, [
        vue.createElementVNode("view", { class: "avatar-upload" }, [
          vue.createElementVNode("text", { class: "label" }, "头像"),
          vue.createElementVNode("view", {
            class: "avatar-wrapper",
            onClick: _cache[0] || (_cache[0] = (...args) => $options.chooseAvatar && $options.chooseAvatar(...args))
          }, [
            $data.form.avatar ? (vue.openBlock(), vue.createElementBlock("image", {
              key: 0,
              src: $data.form.avatar,
              class: "avatar"
            }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "avatar-placeholder"
            }, [
              vue.createElementVNode("text", { class: "avatar-icon" }, "+")
            ]))
          ]),
          vue.createElementVNode("text", { class: "avatar-tip" }, "点击上传头像（可选）")
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "学号 *"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.form.studentId = $event),
              type: "number",
              placeholder: "请输入学号",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.studentId]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "昵称 *"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.form.name = $event),
              type: "text",
              placeholder: "请输入昵称",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.name]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "手机号 *"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.form.phone = $event),
              type: "number",
              placeholder: "请输入手机号",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.phone]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "班级 *"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.form.className = $event),
              type: "text",
              placeholder: "请输入班级（如：计算机2301班）",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.className]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "密码 *"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $data.form.password = $event),
              type: "password",
              placeholder: "请输入密码",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.password]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "label" }, "确认密码 *"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => $data.form.confirmPassword = $event),
              type: "password",
              placeholder: "请再次输入密码",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.confirmPassword]
          ])
        ]),
        vue.createElementVNode("button", {
          class: "submit-btn",
          disabled: !$options.canSubmit,
          onClick: _cache[7] || (_cache[7] = (...args) => $options.handleRegister && $options.handleRegister(...args))
        }, "注册", 8, ["disabled"]),
        vue.createElementVNode("view", { class: "link-row" }, [
          vue.createElementVNode("text", {
            class: "link",
            onClick: _cache[8] || (_cache[8] = (...args) => $options.goLogin && $options.goLogin(...args))
          }, "已有账号？立即登录")
        ])
      ])
    ]);
  }
  const PagesAuthRegister = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["render", _sfc_render$8], ["__scopeId", "data-v-4bb68961"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/auth/register.vue"]]);
  const _sfc_main$8 = {
    data() {
      return {
        format,
        item: null,
        itemId: null,
        isOwnItem: false
      };
    },
    onLoad(options) {
      if (options == null ? void 0 : options.id) {
        this.itemId = options.id;
        this.loadItem();
      }
    },
    methods: {
      getFullImageUrl(url) {
        if (!url)
          return "";
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return url;
        }
        const baseUrl2 = "http://183.66.27.20:41412";
        return baseUrl2 + url;
      },
      getLocalTimeString(timestamp) {
        const date = new Date(timestamp * 1e3);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}`;
      },
      previewImage(index) {
        const urls = this.item.images.map((img) => this.getFullImageUrl(img));
        uni.previewImage({
          urls,
          current: index
        });
      },
      async loadItem() {
        var _a, _b, _c;
        uni.showLoading({ title: "加载中..." });
        try {
          const res = await api.getItem(this.itemId);
          formatAppLog("log", "at pages/item/detail.vue:128", "物品详情数据:", res);
          formatAppLog("log", "at pages/item/detail.vue:129", "发布者信息:", {
            userName: (_a = res.data) == null ? void 0 : _a.userName,
            userAvatar: (_b = res.data) == null ? void 0 : _b.userAvatar,
            userId: (_c = res.data) == null ? void 0 : _c.userId
          });
          this.item = res.data;
          const user = storage.getUser();
          if (user && this.item.userId === user.id) {
            this.isOwnItem = true;
          }
        } catch (err) {
          formatAppLog("error", "at pages/item/detail.vue:141", err);
          uni.showToast({ title: "加载失败", icon: "none" });
        } finally {
          uni.hideLoading();
        }
      },
      goChat() {
        var _a;
        const user = storage.getUser();
        if (!user) {
          uni.showModal({
            title: "提示",
            content: "请先登录后再进行私聊",
            confirmText: "去登录",
            success: (res) => {
              if (res.confirm) {
                uni.navigateTo({ url: "/pages/auth/login" });
              }
            }
          });
          return;
        }
        if ((_a = this.item) == null ? void 0 : _a.userId) {
          const userName = encodeURIComponent(this.item.userName || "未知用户");
          const userAvatar = this.item.userAvatar || "";
          uni.navigateTo({ url: `/pages/message/chat?userId=${this.item.userId}&userName=${userName}&userAvatar=${userAvatar}` });
        }
      },
      solveItem() {
        uni.showModal({
          title: "确认解决",
          content: "确定物品已经找回或归还了吗？",
          success: async (res) => {
            if (res.confirm) {
              uni.showLoading({ title: "处理中..." });
              try {
                await api.solveItem(this.itemId);
                uni.hideLoading();
                uni.showToast({ title: "已标记为解决", icon: "success" });
                this.item.status = "solved";
              } catch (err) {
                uni.hideLoading();
                uni.showToast({ title: "操作失败", icon: "none" });
              }
            }
          }
        });
      },
      deleteItem() {
        uni.showModal({
          title: "删除确认",
          content: "确定要删除这个物品吗？",
          success: async (res) => {
            if (res.confirm) {
              uni.showLoading({ title: "删除中..." });
              try {
                await api.deleteItem(this.itemId);
                uni.hideLoading();
                uni.showToast({ title: "删除成功", icon: "success" });
                setTimeout(() => {
                  uni.navigateBack();
                }, 1500);
              } catch (err) {
                uni.hideLoading();
                uni.showToast({ title: "删除失败", icon: "none" });
              }
            }
          }
        });
      }
    }
  };
  function _sfc_render$7(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      $data.item ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "content"
      }, [
        vue.createElementVNode("view", { class: "image-gallery" }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.item.images, (img, index) => {
              return vue.openBlock(), vue.createElementBlock("image", {
                key: index,
                src: $options.getFullImageUrl(img),
                mode: "widthFix",
                class: "gallery-image",
                onClick: ($event) => $options.previewImage(index)
              }, null, 8, ["src", "onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]),
        vue.createElementVNode("view", { class: "info-card" }, [
          vue.createElementVNode("view", { class: "item-header" }, [
            vue.createElementVNode(
              "text",
              {
                class: vue.normalizeClass(["item-tag", $data.item.type])
              },
              vue.toDisplayString($data.item.type === "lost" ? "寻物启事" : "失物招领"),
              3
              /* TEXT, CLASS */
            ),
            $data.item.status === "solved" ? (vue.openBlock(), vue.createElementBlock("text", {
              key: 0,
              class: "status-tag solved"
            }, "✓ 已解决")) : vue.createCommentVNode("v-if", true)
          ]),
          vue.createElementVNode("view", { class: "publish-time" }, [
            vue.createElementVNode("text", { class: "time-icon" }, "🕒"),
            vue.createElementVNode(
              "text",
              { class: "time-text" },
              "发布于 " + vue.toDisplayString($options.getLocalTimeString($data.item.createdAt)),
              1
              /* TEXT */
            )
          ]),
          vue.createElementVNode(
            "text",
            { class: "item-title" },
            vue.toDisplayString($data.item.title),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "item-desc" },
            vue.toDisplayString($data.item.description),
            1
            /* TEXT */
          ),
          vue.createElementVNode("view", { class: "contact-info" }, [
            vue.createElementVNode("text", { class: "contact-label" }, "联系方式"),
            vue.createElementVNode(
              "text",
              { class: "contact-value" },
              vue.toDisplayString($data.item.contact),
              1
              /* TEXT */
            )
          ]),
          vue.createElementVNode("view", { class: "user-info" }, [
            vue.createElementVNode("view", { class: "avatar" }, [
              $data.item.userAvatar ? (vue.openBlock(), vue.createElementBlock("image", {
                key: 0,
                src: $options.getFullImageUrl($data.item.userAvatar),
                class: "avatar-img",
                mode: "aspectFill"
              }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock(
                "text",
                {
                  key: 1,
                  class: "avatar-text"
                },
                vue.toDisplayString(($data.item.userName || "?").charAt(0)),
                1
                /* TEXT */
              ))
            ]),
            vue.createElementVNode("view", { class: "user-detail" }, [
              vue.createElementVNode(
                "text",
                { class: "user-name" },
                vue.toDisplayString($data.item.userName || "校园用户"),
                1
                /* TEXT */
              ),
              vue.createElementVNode(
                "text",
                { class: "user-class" },
                vue.toDisplayString($data.item.userClassName || ""),
                1
                /* TEXT */
              )
            ])
          ])
        ])
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "loading"
      }, [
        vue.createElementVNode("text", null, "加载中...")
      ])),
      $data.item ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "footer"
      }, [
        $data.isOwnItem && $data.item.status === "active" ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "footer-buttons"
        }, [
          vue.createElementVNode("button", {
            class: "solve-btn",
            onClick: _cache[0] || (_cache[0] = (...args) => $options.solveItem && $options.solveItem(...args))
          }, [
            vue.createElementVNode("text", null, "✓ 已解决")
          ]),
          vue.createElementVNode("button", {
            class: "delete-btn",
            onClick: _cache[1] || (_cache[1] = (...args) => $options.deleteItem && $options.deleteItem(...args))
          }, [
            vue.createElementVNode("text", null, "🗑️ 删除")
          ])
        ])) : $data.isOwnItem && $data.item.status === "solved" ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "footer-buttons"
        }, [
          vue.createElementVNode("button", {
            class: "delete-btn",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.deleteItem && $options.deleteItem(...args))
          }, [
            vue.createElementVNode("text", null, "🗑️ 删除")
          ])
        ])) : (vue.openBlock(), vue.createElementBlock("button", {
          key: 2,
          class: "chat-btn",
          onClick: _cache[3] || (_cache[3] = (...args) => $options.goChat && $options.goChat(...args))
        }, [
          vue.createElementVNode("text", { class: "chat-icon" }, "💬"),
          vue.createElementVNode("text", null, "联系对方")
        ]))
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesItemDetail = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["render", _sfc_render$7], ["__scopeId", "data-v-e4435ae8"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/item/detail.vue"]]);
  const _sfc_main$7 = {
    data() {
      return {
        format,
        userId: "",
        userName: "",
        userAvatar: "",
        // 对方头像
        currentUserId: "",
        currentUserName: "",
        currentUserAvatar: "",
        // 自己头像
        messages: [],
        inputText: "",
        scrollTop: 0,
        pollTimer: null,
        showScrollBtn: false,
        newMsgCount: 0,
        scrollToId: "",
        // 用于scroll-into-view
        contextMenu: {
          show: false,
          msg: null,
          actions: [],
          y: 0,
          x: 0
        }
      };
    },
    computed: {
      contextMenuStyle() {
        const sysInfo = uni.getSystemInfoSync();
        const menuW = 160;
        const x = Math.min(this.contextMenu.x, sysInfo.windowWidth - menuW - 8);
        const safeX = Math.max(x, 8);
        return `top: ${this.contextMenu.y}px; left: ${safeX}px;`;
      }
    },
    onLoad(options) {
      if (options == null ? void 0 : options.userId) {
        this.userId = options.userId;
        this.userName = decodeURIComponent(options.userName || "校园用户");
        this.userAvatar = options.userAvatar || "";
      }
      const user = storage.getUser();
      if (user) {
        this.currentUserId = user.id;
        this.currentUserName = user.name;
        this.currentUserAvatar = user.avatar || "";
      }
      this.loadMessages();
      this.startPoll();
    },
    onShow() {
      this.loadMessages();
      this.markAsRead();
    },
    onHide() {
      this.stopPoll();
    },
    onUnload() {
      this.stopPoll();
      this.clearUnreadBadge();
    },
    methods: {
      getFullImageUrl(url) {
        if (!url)
          return "";
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return url;
        }
        const baseUrl2 = "http://183.66.27.20:41412";
        return baseUrl2 + url;
      },
      formatMessageTime(timestamp) {
        const date = new Date(timestamp);
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
      },
      startPoll() {
        this.stopPoll();
        this.pollTimer = setInterval(() => {
          this.loadMessages(true);
        }, 3e3);
      },
      stopPoll() {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
      },
      scrollToBottom() {
        this.showScrollBtn = false;
        this.newMsgCount = 0;
        this.$nextTick(() => {
          const lastIndex = this.messages.length - 1;
          if (lastIndex >= 0) {
            this.scrollToId = `msg-${lastIndex}`;
            setTimeout(() => {
              this.scrollToId = "";
            }, 500);
          }
        });
      },
      goBack() {
        uni.navigateBack();
      },
      showMoreOptions() {
        this.checkBlockStatus();
      },
      async checkBlockStatus() {
        try {
          const res = await api.getBlockedUsers();
          const isBlocked = res.data.some((u) => u.id === this.userId);
          uni.showActionSheet({
            itemList: isBlocked ? ["取消拉黑"] : ["拉黑对方"],
            success: async (actionRes) => {
              if (isBlocked) {
                this.confirmUnblock();
              } else {
                this.confirmBlock();
              }
            }
          });
        } catch (err) {
          formatAppLog("error", "at pages/message/chat.vue:270", "获取拉黑列表失败:", err);
        }
      },
      confirmBlock() {
        uni.showModal({
          title: "确认拉黑",
          content: "拉黑后将删除所有对话，对方将无法给你发送消息",
          confirmText: "拉黑",
          confirmColor: "#ff4757",
          success: async (res) => {
            if (res.confirm) {
              try {
                await api.blockUser(this.userId);
                uni.showToast({ title: "拉黑成功", icon: "success" });
                setTimeout(() => {
                  uni.navigateBack();
                }, 1500);
              } catch (err) {
                uni.showToast({ title: "拉黑失败", icon: "none" });
              }
            }
          }
        });
      },
      confirmUnblock() {
        uni.showModal({
          title: "取消拉黑",
          content: "取消拉黑后，对方将可以再次给你发送消息",
          confirmText: "取消拉黑",
          confirmColor: "#667eea",
          success: async (res) => {
            if (res.confirm) {
              try {
                await api.unblockUser(this.userId);
                uni.showToast({ title: "已取消拉黑", icon: "success" });
              } catch (err) {
                uni.showToast({ title: "操作失败", icon: "none" });
              }
            }
          }
        });
      },
      async loadMessages(silent = false) {
        try {
          const res = await api.getConversation(this.userId);
          const oldLen = this.messages.length;
          this.messages = res.data;
          if (!silent) {
            setTimeout(() => {
              const lastIndex = this.messages.length - 1;
              if (lastIndex >= 0) {
                this.scrollToId = `msg-${lastIndex}`;
                setTimeout(() => {
                  this.scrollToId = "";
                }, 500);
              }
            }, 100);
            this.newMsgCount = 0;
            this.showScrollBtn = false;
          } else {
            if (res.data.length > oldLen) {
              this.newMsgCount = res.data.length - oldLen;
              this.showScrollBtn = true;
            }
          }
        } catch (err) {
          formatAppLog("error", "at pages/message/chat.vue:340", err);
        }
      },
      async sendMessage() {
        if (!this.inputText.trim())
          return;
        const content = this.inputText.trim();
        this.inputText = "";
        try {
          await api.sendMessage(this.userId, content);
          this.loadMessages();
          this.scrollToBottom();
        } catch (err) {
          uni.showToast({ title: "发送失败", icon: "none" });
          this.inputText = content;
        }
      },
      chooseImage() {
        uni.chooseImage({
          count: 9,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: async (res) => {
            const filePaths = res.tempFilePaths;
            uni.showLoading({ title: "上传中..." });
            try {
              for (let filePath of filePaths) {
                const result = await api.uploadImage(filePath);
                await api.sendMessage(this.userId, "", "image", result.url);
              }
              uni.hideLoading();
              this.loadMessages();
            } catch (err) {
              uni.hideLoading();
              uni.showToast({ title: "图片发送失败", icon: "none" });
            }
          }
        });
      },
      chooseVideo() {
        uni.chooseVideo({
          sourceType: ["album", "camera"],
          maxDuration: 60,
          camera: "back",
          compressed: false,
          // 不压缩视频，保持原始质量
          success: async (res) => {
            const { tempFilePath, size } = res;
            if (size > 1024 * 1024 * 1024) {
              uni.showToast({ title: "视频大小不能超过1GB", icon: "none" });
              return;
            }
            uni.showLoading({ title: "上传视频中..." });
            try {
              const result = await api.uploadVideo(tempFilePath);
              await api.sendMessage(this.userId, "", "video", result.url);
              uni.hideLoading();
              this.loadMessages();
            } catch (err) {
              uni.hideLoading();
              uni.showToast({ title: "视频发送失败", icon: "none" });
            }
          },
          fail: () => {
            uni.showToast({ title: "取消选择", icon: "none" });
          }
        });
      },
      previewImage(url) {
        uni.previewImage({
          urls: [url],
          current: url
        });
      },
      playVideo(url) {
        uni.navigateTo({
          url: `/pages/message/video-player?url=${encodeURIComponent(url)}`
        });
      },
      loadMore() {
      },
      // 长按消息
      onLongPress(msg) {
        if (msg.type === "recalled")
          return;
        const actions = [];
        const isMine = msg.senderId === this.currentUserId;
        if (isMine) {
          const now = Date.now();
          const msgTime = new Date(msg.createdAt).getTime();
          const diff = now - msgTime;
          if (diff < 2 * 60 * 1e3) {
            actions.push({ key: "recall", label: "撤回", icon: "↩", danger: true });
          } else {
            uni.showToast({ title: "超过2分钟，无法撤回", icon: "none", duration: 1500 });
            if (msg.type !== "text")
              return;
          }
        }
        if (msg.type === "text") {
          actions.push({ key: "copy", label: "复制", icon: "📋" });
        }
        if (actions.length === 0)
          return;
        uni.createSelectorQuery().in(this).select(`#msg-${this.messages.indexOf(msg)}`).boundingClientRect((rect) => {
          const sysInfo = uni.getSystemInfoSync();
          const menuW = 160;
          let x;
          if (isMine) {
            x = Math.max(rect.right - menuW - 20, 20);
          } else {
            x = Math.min(rect.left + 20, sysInfo.windowWidth - menuW - 20);
          }
          const y = rect.top + rect.height / 2;
          this.contextMenu = {
            show: true,
            msg,
            actions,
            x,
            y
          };
        }).exec();
      },
      closeContextMenu() {
        this.contextMenu.show = false;
        this.contextMenu.msg = null;
      },
      async handleContextAction(key) {
        const msg = this.contextMenu.msg;
        this.closeContextMenu();
        if (key === "recall") {
          if (this._recalling)
            return;
          this._recalling = true;
          try {
            await api.recallMessage(msg.id);
            const idx = this.messages.findIndex((m) => m.id === msg.id);
            if (idx !== -1) {
              this.$set(this.messages, idx, { ...msg, type: "recalled" });
            }
            uni.showToast({ title: "已撤回", icon: "success" });
          } catch (err) {
            uni.showToast({ title: err.message || "撤回失败", icon: "none" });
          } finally {
            this._recalling = false;
          }
        } else if (key === "copy") {
          uni.setClipboardData({
            data: msg.content,
            success: () => {
              uni.showToast({ title: "已复制", icon: "success" });
            }
          });
        }
      },
      // 标记当前对话为已读
      async markAsRead() {
        try {
          await api.markConversationRead(this.userId);
        } catch (err) {
          formatAppLog("error", "at pages/message/chat.vue:521", "标记已读失败:", err);
        }
      },
      // 清除当前对话的未读角标（退出时调用）
      async clearUnreadBadge() {
        try {
          await api.markConversationRead(this.userId);
        } catch (err) {
          formatAppLog("error", "at pages/message/chat.vue:530", "清除未读数失败:", err);
        }
      }
    }
  };
  function _sfc_render$6(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("view", {
          class: "back-btn",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goBack && $options.goBack(...args))
        }, [
          vue.createElementVNode("text", null, "‹")
        ]),
        vue.createElementVNode("view", { class: "user-info" }, [
          vue.createElementVNode("view", { class: "avatar" }, [
            $data.userAvatar ? (vue.openBlock(), vue.createElementBlock("image", {
              key: 0,
              src: $options.getFullImageUrl($data.userAvatar),
              mode: "aspectFill",
              class: "avatar-img"
            }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock(
              "text",
              { key: 1 },
              vue.toDisplayString(($data.userName || "?").charAt(0)),
              1
              /* TEXT */
            ))
          ]),
          vue.createElementVNode(
            "text",
            { class: "user-name" },
            vue.toDisplayString($data.userName),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", {
          class: "more-btn",
          onClick: _cache[1] || (_cache[1] = (...args) => $options.showMoreOptions && $options.showMoreOptions(...args))
        }, [
          vue.createElementVNode("text", null, "⋯")
        ])
      ]),
      vue.createElementVNode("scroll-view", {
        id: "msgScroll",
        class: "message-list",
        "scroll-y": "",
        "scroll-with-animation": "",
        "scroll-into-view": $data.scrollToId,
        onScrolltolower: _cache[2] || (_cache[2] = (...args) => $options.loadMore && $options.loadMore(...args))
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.messages, (msg, index) => {
            var _a;
            return vue.openBlock(), vue.createElementBlock("view", {
              key: msg.id,
              id: "msg-" + index,
              class: vue.normalizeClass(["message-item", msg.senderId === $data.currentUserId ? "self" : "other"])
            }, [
              msg.senderId !== $data.currentUserId ? (vue.openBlock(), vue.createElementBlock("view", {
                key: 0,
                class: "avatar msg-avatar"
              }, [
                msg.senderAvatar ? (vue.openBlock(), vue.createElementBlock("image", {
                  key: 0,
                  src: $options.getFullImageUrl(msg.senderAvatar),
                  mode: "aspectFill",
                  class: "avatar-img"
                }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock(
                  "text",
                  { key: 1 },
                  vue.toDisplayString((msg.senderName || "?").charAt(0)),
                  1
                  /* TEXT */
                ))
              ])) : vue.createCommentVNode("v-if", true),
              vue.createElementVNode("view", {
                class: "message-content",
                onLongpress: ($event) => $options.onLongPress(msg)
              }, [
                msg.type === "text" ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 0,
                  class: "text-message"
                }, [
                  vue.createElementVNode(
                    "text",
                    null,
                    vue.toDisplayString(msg.content),
                    1
                    /* TEXT */
                  )
                ])) : msg.type === "image" ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 1,
                  class: "media-message image-message"
                }, [
                  vue.createElementVNode("image", {
                    src: $options.getFullImageUrl(msg.mediaUrl),
                    mode: "widthFix",
                    class: "media-img",
                    onClick: ($event) => $options.previewImage(msg.mediaUrl)
                  }, null, 8, ["src", "onClick"])
                ])) : msg.type === "video" ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 2,
                  class: "media-message video-message",
                  onClick: ($event) => $options.playVideo(msg.mediaUrl)
                }, [
                  vue.createElementVNode("image", {
                    src: $options.getFullImageUrl(msg.mediaUrl),
                    mode: "aspectFill",
                    class: "video-thumb"
                  }, null, 8, ["src"]),
                  vue.createElementVNode("view", { class: "video-play-overlay" }, [
                    vue.createElementVNode("view", { class: "video-play-icon" }, [
                      vue.createElementVNode("text", null, "▶")
                    ])
                  ])
                ], 8, ["onClick"])) : msg.type === "recalled" ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 3,
                  class: "recalled-message"
                }, [
                  vue.createElementVNode(
                    "text",
                    null,
                    vue.toDisplayString(msg.senderId === $data.currentUserId ? "你撤回了一条消息" : "对方撤回了一条消息"),
                    1
                    /* TEXT */
                  )
                ])) : vue.createCommentVNode("v-if", true),
                vue.createElementVNode(
                  "text",
                  { class: "message-time" },
                  vue.toDisplayString($options.formatMessageTime(msg.createdAt)),
                  1
                  /* TEXT */
                )
              ], 40, ["onLongpress"]),
              msg.senderId === $data.currentUserId ? (vue.openBlock(), vue.createElementBlock("view", {
                key: 1,
                class: "avatar msg-avatar"
              }, [
                $data.currentUserAvatar ? (vue.openBlock(), vue.createElementBlock("image", {
                  key: 0,
                  src: $options.getFullImageUrl($data.currentUserAvatar),
                  mode: "aspectFill",
                  class: "avatar-img"
                }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock(
                  "text",
                  { key: 1 },
                  vue.toDisplayString(((_a = $data.currentUserName) == null ? void 0 : _a.charAt(0)) || "?"),
                  1
                  /* TEXT */
                ))
              ])) : vue.createCommentVNode("v-if", true)
            ], 10, ["id"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ], 40, ["scroll-into-view"]),
      $data.showScrollBtn ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "scroll-bottom-btn",
        onClick: _cache[3] || (_cache[3] = (...args) => $options.scrollToBottom && $options.scrollToBottom(...args))
      }, [
        vue.createElementVNode("text", { class: "scroll-icon" }, "⬇"),
        $data.newMsgCount > 0 ? (vue.openBlock(), vue.createElementBlock(
          "text",
          {
            key: 0,
            class: "scroll-count"
          },
          vue.toDisplayString($data.newMsgCount),
          1
          /* TEXT */
        )) : vue.createCommentVNode("v-if", true)
      ])) : vue.createCommentVNode("v-if", true),
      vue.createElementVNode("view", { class: "input-area" }, [
        vue.createElementVNode("view", { class: "input-tools" }, [
          vue.createElementVNode("view", {
            class: "tool-btn",
            onClick: _cache[4] || (_cache[4] = (...args) => $options.chooseImage && $options.chooseImage(...args))
          }, [
            vue.createElementVNode("text", null, "📷")
          ]),
          vue.createElementVNode("view", {
            class: "tool-btn",
            onClick: _cache[5] || (_cache[5] = (...args) => $options.chooseVideo && $options.chooseVideo(...args))
          }, [
            vue.createElementVNode("text", null, "🎬")
          ])
        ]),
        vue.createElementVNode("view", { class: "input-wrapper" }, [
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => $data.inputText = $event),
              class: "message-input",
              placeholder: "输入消息...",
              onConfirm: _cache[7] || (_cache[7] = (...args) => $options.sendMessage && $options.sendMessage(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.inputText]
          ]),
          vue.createElementVNode("button", {
            class: "send-btn",
            disabled: !$data.inputText.trim(),
            onClick: _cache[8] || (_cache[8] = (...args) => $options.sendMessage && $options.sendMessage(...args))
          }, [
            vue.createElementVNode("text", null, "发送")
          ], 8, ["disabled"])
        ])
      ]),
      $data.contextMenu.show ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "context-menu-mask",
        onClick: _cache[10] || (_cache[10] = (...args) => $options.closeContextMenu && $options.closeContextMenu(...args))
      }, [
        vue.createElementVNode(
          "view",
          {
            class: "context-menu",
            style: vue.normalizeStyle($options.contextMenuStyle),
            onClick: _cache[9] || (_cache[9] = vue.withModifiers(() => {
            }, ["stop"]))
          },
          [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.contextMenu.actions, (item) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: item.key,
                  class: vue.normalizeClass(["context-menu-item", item.danger ? "danger" : ""]),
                  onClick: ($event) => $options.handleContextAction(item.key)
                }, [
                  vue.createElementVNode(
                    "text",
                    { class: "menu-icon" },
                    vue.toDisplayString(item.icon),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "menu-label" },
                    vue.toDisplayString(item.label),
                    1
                    /* TEXT */
                  )
                ], 10, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ],
          4
          /* STYLE */
        )
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesMessageChat = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["render", _sfc_render$6], ["__scopeId", "data-v-013fa921"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/message/chat.vue"]]);
  const _sfc_main$6 = {
    data() {
      return {
        format,
        activeTab: "all",
        status: "active",
        items: [],
        tabs: [
          { value: "all", label: "全部" },
          { value: "lost", label: "寻物启事" },
          { value: "found", label: "失物招领" }
        ]
      };
    },
    onLoad(options) {
      if (options == null ? void 0 : options.type) {
        this.activeTab = options.type;
      }
      if (options == null ? void 0 : options.status) {
        this.status = options.status;
      }
      this.loadItems();
    },
    methods: {
      goBack() {
        uni.navigateBack();
      },
      async handleTabChange(value) {
        this.activeTab = value;
        this.items = [];
        await this.loadItems();
      },
      async loadItems() {
        uni.showLoading({ title: "加载中..." });
        try {
          const res = await api.getUserItems({
            type: this.activeTab,
            status: this.status,
            page: 1,
            pageSize: 100
          });
          this.items = res.data || [];
        } catch (err) {
          uni.showToast({ title: "加载失败", icon: "none" });
        }
        uni.hideLoading();
      },
      goDetail(id) {
        uni.navigateTo({ url: `/pages/item/detail?id=${id}` });
      }
    }
  };
  function _sfc_render$5(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("view", {
          class: "back-btn",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goBack && $options.goBack(...args))
        }, [
          vue.createElementVNode("text", null, "‹")
        ]),
        vue.createElementVNode("text", { class: "title" }, "我的发布"),
        vue.createElementVNode("view", { class: "placeholder" })
      ]),
      vue.createElementVNode("view", { class: "tabs" }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.tabs, (tab) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: tab.value,
              class: vue.normalizeClass(["tab-item", { active: $data.activeTab === tab.value }]),
              onClick: ($event) => $options.handleTabChange(tab.value)
            }, [
              vue.createElementVNode(
                "text",
                null,
                vue.toDisplayString(tab.label),
                1
                /* TEXT */
              )
            ], 10, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]),
      vue.createElementVNode("scroll-view", {
        class: "items-container",
        "scroll-y": ""
      }, [
        $data.items.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "empty-state"
        }, [
          vue.createElementVNode("text", { class: "empty-icon" }, "📦"),
          vue.createElementVNode("text", { class: "empty-text" }, "暂无发布记录")
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "items-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.items, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: item.id,
                class: "item-card",
                onClick: ($event) => $options.goDetail(item.id)
              }, [
                vue.createElementVNode("image", {
                  src: item.images[0] || "/placeholder.png",
                  class: "item-image",
                  mode: "aspectFill"
                }, null, 8, ["src"]),
                vue.createElementVNode("view", { class: "item-info" }, [
                  vue.createElementVNode("view", { class: "item-header" }, [
                    vue.createElementVNode(
                      "span",
                      {
                        class: vue.normalizeClass(["tag", `tag-${item.type}`])
                      },
                      vue.toDisplayString(item.type === "lost" ? "寻物" : "招领"),
                      3
                      /* TEXT, CLASS */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "item-time" },
                      vue.toDisplayString($data.format.formatTime(item.createdAt)),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode(
                    "text",
                    { class: "item-title" },
                    vue.toDisplayString(item.title),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "item-desc" },
                    vue.toDisplayString(item.description),
                    1
                    /* TEXT */
                  )
                ])
              ], 8, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]))
      ])
    ]);
  }
  const PagesUserMyItems = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["render", _sfc_render$5], ["__scopeId", "data-v-05450a40"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/user/my-items.vue"]]);
  const _sfc_main$5 = {
    data() {
      return {
        collections: []
      };
    },
    onLoad() {
      this.loadCollections();
    },
    methods: {
      loadCollections() {
        this.collections = [];
      },
      goBack() {
        uni.navigateBack();
      },
      goDetail(id) {
        uni.navigateTo({ url: `/pages/item/detail?id=${id}` });
      },
      removeCollection(id) {
        uni.showModal({
          title: "取消收藏",
          content: "确定取消收藏这个物品吗？",
          success: (res) => {
            if (res.confirm) {
              this.collections = this.collections.filter((item) => item.id !== id);
              uni.showToast({ title: "取消成功", icon: "success" });
            }
          }
        });
      }
    }
  };
  function _sfc_render$4(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("text", { class: "header-title" }, "我的收藏"),
        vue.createElementVNode("view", {
          class: "back-btn",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goBack && $options.goBack(...args))
        }, [
          vue.createElementVNode("text", null, "‹")
        ])
      ]),
      $data.collections.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "empty-state"
      }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "❤️"),
        vue.createElementVNode("text", { class: "empty-text" }, "暂无收藏"),
        vue.createElementVNode("text", { class: "empty-desc" }, "收藏喜欢的物品，方便随时查看")
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "collection-list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.collections, (item) => {
            var _a;
            return vue.openBlock(), vue.createElementBlock("view", {
              key: item.id,
              class: "collection-item",
              onClick: ($event) => $options.goDetail(item.id)
            }, [
              ((_a = item.images) == null ? void 0 : _a[0]) ? (vue.openBlock(), vue.createElementBlock("image", {
                key: 0,
                src: item.images[0],
                class: "item-image"
              }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("view", {
                key: 1,
                class: "item-placeholder"
              }, [
                vue.createElementVNode("text", { class: "placeholder-icon" }, "📦")
              ])),
              vue.createElementVNode("view", { class: "item-info" }, [
                vue.createElementVNode(
                  "text",
                  { class: "item-title" },
                  vue.toDisplayString(item.title),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "item-desc" },
                  vue.toDisplayString(item.description),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode("view", { class: "item-meta" }, [
                  vue.createElementVNode(
                    "text",
                    {
                      class: vue.normalizeClass(["item-tag", item.type === "lost" ? "lost" : "found"])
                    },
                    vue.toDisplayString(item.type === "lost" ? "寻物" : "招领"),
                    3
                    /* TEXT, CLASS */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "item-time" },
                    vue.toDisplayString(_ctx.format.formatTime(item.createdAt)),
                    1
                    /* TEXT */
                  )
                ])
              ]),
              vue.createElementVNode("view", {
                class: "remove-btn",
                onClick: vue.withModifiers(($event) => $options.removeCollection(item.id), ["stop"])
              }, [
                vue.createElementVNode("text", null, "×")
              ], 8, ["onClick"])
            ], 8, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]))
    ]);
  }
  const PagesUserMyCollection = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["render", _sfc_render$4], ["__scopeId", "data-v-5a63f6f3"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/user/my-collection.vue"]]);
  const _sfc_main$4 = {
    data() {
      return {
        user: null,
        formData: {
          studentId: "",
          name: "",
          className: "",
          phone: "",
          avatar: ""
        }
      };
    },
    onLoad() {
      this.user = storage.getUser();
      if (this.user) {
        this.formData = {
          studentId: this.user.studentId,
          name: this.user.name,
          className: this.user.className,
          phone: this.user.phone,
          avatar: this.user.avatar
        };
      }
    },
    methods: {
      getFullImageUrl(url) {
        if (!url)
          return "";
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return url;
        }
        const baseUrl2 = "http://183.66.27.20:41412";
        return baseUrl2 + url;
      },
      goBack() {
        uni.navigateBack();
      },
      chooseAvatar() {
        uni.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: async (res) => {
            const filePath = res.tempFilePaths[0];
            uni.showLoading({ title: "上传中..." });
            try {
              const result = await api.uploadImage(filePath);
              this.formData.avatar = result.url;
              uni.hideLoading();
            } catch (err) {
              uni.hideLoading();
              uni.showToast({ title: "上传失败", icon: "none" });
            }
          }
        });
      },
      async submitForm() {
        if (!this.formData.name) {
          uni.showToast({ title: "请输入昵称", icon: "none" });
          return;
        }
        uni.showLoading({ title: "保存中..." });
        try {
          await api.updateUserInfo({
            name: this.formData.name,
            className: this.formData.className,
            phone: this.formData.phone,
            avatar: this.formData.avatar
          });
          const updatedUser = { ...this.user, ...this.formData };
          storage.setUser(updatedUser);
          uni.hideLoading();
          uni.showToast({ title: "保存成功", icon: "success" });
          setTimeout(() => {
            uni.navigateBack();
          }, 1500);
        } catch (err) {
          uni.hideLoading();
          uni.showToast({ title: "保存失败", icon: "none" });
        }
      }
    }
  };
  function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
    var _a, _b;
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("text", { class: "header-title" }, "编辑资料"),
        vue.createElementVNode("view", {
          class: "back-btn",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goBack && $options.goBack(...args))
        }, [
          vue.createElementVNode("text", null, "‹")
        ])
      ]),
      vue.createElementVNode("view", { class: "form-container" }, [
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "form-label" }, "头像"),
          vue.createElementVNode("view", {
            class: "avatar-wrapper",
            onClick: _cache[1] || (_cache[1] = (...args) => $options.chooseAvatar && $options.chooseAvatar(...args))
          }, [
            $data.formData.avatar ? (vue.openBlock(), vue.createElementBlock("image", {
              key: 0,
              src: $options.getFullImageUrl($data.formData.avatar),
              class: "avatar"
            }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "avatar"
            }, [
              vue.createElementVNode(
                "text",
                { class: "avatar-text" },
                vue.toDisplayString(((_b = (_a = $data.user) == null ? void 0 : _a.name) == null ? void 0 : _b.charAt(0)) || "?"),
                1
                /* TEXT */
              )
            ])),
            vue.createElementVNode("view", { class: "avatar-edit" }, [
              vue.createElementVNode("text", { class: "edit-icon" }, "📷")
            ])
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "form-label" }, "学号"),
          vue.createElementVNode("input", {
            class: "form-input",
            value: $data.formData.studentId,
            disabled: "",
            placeholder: "学号"
          }, null, 8, ["value"])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "form-label" }, "昵称"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "form-input",
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.formData.name = $event),
              placeholder: "请输入昵称"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.formData.name]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "form-label" }, "班级"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "form-input",
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.formData.className = $event),
              placeholder: "请输入班级"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.formData.className]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "form-label" }, "电话"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "form-input",
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.formData.phone = $event),
              placeholder: "请输入手机号",
              type: "number"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.formData.phone]
          ])
        ]),
        vue.createElementVNode("button", {
          class: "submit-btn",
          onClick: _cache[5] || (_cache[5] = (...args) => $options.submitForm && $options.submitForm(...args))
        }, "保存修改")
      ])
    ]);
  }
  const PagesUserEdit = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["render", _sfc_render$3], ["__scopeId", "data-v-590d0314"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/user/edit.vue"]]);
  const _sfc_main$3 = {
    data() {
      return {
        notifications: true,
        darkMode: false
      };
    },
    onLoad() {
      this.loadSettings();
    },
    methods: {
      loadSettings() {
        const settings = storage.getSettings() || {};
        this.darkMode = settings.darkMode !== void 0 ? settings.darkMode : false;
      },
      goBack() {
        uni.navigateBack();
      },
      toggleNotifications(e) {
        this.notifications = e.detail.value;
        uni.showToast({
          title: this.notifications ? "已开启通知" : "已关闭通知",
          icon: "none"
        });
      },
      toggleDarkMode(e) {
        this.darkMode = e.detail.value;
        const settings = storage.getSettings() || {};
        settings.darkMode = this.darkMode;
        storage.setSettings(settings);
        if (this.darkMode) {
          uni.setNavigationBarColor({
            frontColor: "#ffffff",
            backgroundColor: "#1a1a1a"
          });
        } else {
          uni.setNavigationBarColor({
            frontColor: "#000000",
            backgroundColor: "#ffffff"
          });
        }
        uni.showToast({
          title: this.darkMode ? "深色模式已开启" : "深色模式已关闭",
          icon: "none"
        });
      },
      clearCache() {
        uni.showModal({
          title: "清除缓存",
          content: "确定要清除应用缓存吗？",
          success: (res) => {
            if (res.confirm) {
              try {
                uni.clearStorageSync();
                uni.showToast({ title: "缓存已清除", icon: "success" });
              } catch (err) {
                uni.showToast({ title: "清除失败", icon: "none" });
              }
            }
          }
        });
      },
      showAbout() {
        uni.showModal({
          title: "关于校园失物招领",
          content: "校园失物招领App帮助同学们快速找回丢失的物品，让每一件失物都能回家。",
          showCancel: false
        });
      }
    }
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: vue.normalizeClass(["container", { dark: $data.darkMode }])
      },
      [
        vue.createElementVNode("view", { class: "header" }, [
          vue.createElementVNode("text", { class: "header-title" }, "设置"),
          vue.createElementVNode("view", {
            class: "back-btn",
            onClick: _cache[0] || (_cache[0] = (...args) => $options.goBack && $options.goBack(...args))
          }, [
            vue.createElementVNode("text", null, "‹")
          ])
        ]),
        vue.createElementVNode("view", { class: "settings-list" }, [
          vue.createElementVNode("view", { class: "settings-item" }, [
            vue.createElementVNode("text", { class: "settings-icon" }, "🔔"),
            vue.createElementVNode("text", { class: "settings-text" }, "消息通知"),
            vue.createElementVNode("switch", {
              checked: $data.notifications,
              onChange: _cache[1] || (_cache[1] = (...args) => $options.toggleNotifications && $options.toggleNotifications(...args)),
              color: "#667eea"
            }, null, 40, ["checked"])
          ]),
          vue.createElementVNode("view", { class: "settings-item" }, [
            vue.createElementVNode("text", { class: "settings-icon" }, "🌙"),
            vue.createElementVNode("text", { class: "settings-text" }, "深色模式"),
            vue.createElementVNode("switch", {
              checked: $data.darkMode,
              onChange: _cache[2] || (_cache[2] = (...args) => $options.toggleDarkMode && $options.toggleDarkMode(...args)),
              color: "#667eea"
            }, null, 40, ["checked"])
          ]),
          vue.createElementVNode("view", {
            class: "settings-item",
            onClick: _cache[3] || (_cache[3] = (...args) => $options.clearCache && $options.clearCache(...args))
          }, [
            vue.createElementVNode("text", { class: "settings-icon" }, "🗑️"),
            vue.createElementVNode("text", { class: "settings-text" }, "清除缓存"),
            vue.createElementVNode("text", { class: "settings-arrow" }, "›")
          ]),
          vue.createElementVNode("view", {
            class: "settings-item",
            onClick: _cache[4] || (_cache[4] = (...args) => $options.showAbout && $options.showAbout(...args))
          }, [
            vue.createElementVNode("text", { class: "settings-icon" }, "ℹ️"),
            vue.createElementVNode("text", { class: "settings-text" }, "关于我们"),
            vue.createElementVNode("text", { class: "settings-arrow" }, "›")
          ])
        ]),
        vue.createElementVNode("view", { class: "version-info" }, [
          vue.createElementVNode("text", { class: "version-text" }, "版本 1.0.0")
        ])
      ],
      2
      /* CLASS */
    );
  }
  const PagesUserSettings = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__scopeId", "data-v-ce914230"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/user/settings.vue"]]);
  const _sfc_main$2 = {
    data() {
      return {
        blockedUsers: [],
        loading: true
      };
    },
    onLoad() {
      this.loadBlockedUsers();
    },
    onShow() {
      this.loadBlockedUsers();
    },
    methods: {
      getFullImageUrl(url) {
        if (!url)
          return "";
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return url;
        }
        const baseUrl2 = "http://183.66.27.20:41412";
        return baseUrl2 + url;
      },
      async loadBlockedUsers() {
        this.loading = true;
        try {
          const res = await api.getBlockedUsers();
          this.blockedUsers = res.data || [];
        } catch (err) {
          formatAppLog("error", "at pages/user/blocked-users.vue:72", "加载黑名单失败:", err);
          uni.showToast({ title: "加载失败", icon: "none" });
        } finally {
          this.loading = false;
        }
      },
      confirmUnblock(user) {
        uni.showModal({
          title: "取消拉黑",
          content: `确定要取消拉黑 "${user.name || "校园用户"}" 吗？`,
          confirmText: "取消拉黑",
          confirmColor: "#667eea",
          success: async (res) => {
            if (res.confirm) {
              await this.unblockUser(user);
            }
          }
        });
      },
      async unblockUser(user) {
        try {
          await api.unblockUser(user.id);
          uni.showToast({ title: "已取消拉黑", icon: "success" });
          this.loadBlockedUsers();
        } catch (err) {
          formatAppLog("error", "at pages/user/blocked-users.vue:98", "取消拉黑失败:", err);
          uni.showToast({ title: "操作失败", icon: "none" });
        }
      }
    }
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("text", { class: "title" }, "黑名单管理"),
        vue.createElementVNode("text", { class: "subtitle" }, "已拉黑的用户将无法给你发送消息")
      ]),
      $data.loading ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "loading"
      }, [
        vue.createElementVNode("text", null, "加载中...")
      ])) : $data.blockedUsers.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "empty"
      }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "🚫"),
        vue.createElementVNode("text", { class: "empty-text" }, "暂无拉黑用户")
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "blocked-list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.blockedUsers, (user) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: user.id,
              class: "blocked-item"
            }, [
              vue.createElementVNode("view", { class: "user-info" }, [
                vue.createElementVNode("view", { class: "avatar" }, [
                  user.avatar ? (vue.openBlock(), vue.createElementBlock("image", {
                    key: 0,
                    src: $options.getFullImageUrl(user.avatar),
                    mode: "aspectFill",
                    class: "avatar-img"
                  }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock(
                    "text",
                    {
                      key: 1,
                      class: "avatar-text"
                    },
                    vue.toDisplayString((user.name || "?").charAt(0)),
                    1
                    /* TEXT */
                  ))
                ]),
                vue.createElementVNode("view", { class: "info" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "user-name" },
                    vue.toDisplayString(user.name || "校园用户"),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "user-id" },
                    "ID: " + vue.toDisplayString(user.id),
                    1
                    /* TEXT */
                  )
                ])
              ]),
              vue.createElementVNode("view", { class: "actions" }, [
                vue.createElementVNode("button", {
                  class: "unblock-btn",
                  onClick: ($event) => $options.confirmUnblock(user)
                }, "取消拉黑", 8, ["onClick"])
              ])
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]))
    ]);
  }
  const PagesUserBlockedUsers = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__scopeId", "data-v-77bb66ec"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/user/blocked-users.vue"]]);
  const _sfc_main$1 = {
    data() {
      return {
        videoUrl: ""
      };
    },
    onLoad(options) {
      if (options == null ? void 0 : options.url) {
        this.videoUrl = decodeURIComponent(options.url);
      }
    },
    methods: {
      close() {
        uni.navigateBack();
      },
      onVideoError(err) {
        uni.showToast({ title: "视频播放失败", icon: "none" });
      }
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "video-container" }, [
        vue.createElementVNode("video", {
          src: $data.videoUrl,
          autoplay: "",
          controls: "",
          class: "video-player",
          onError: _cache[0] || (_cache[0] = (...args) => $options.onVideoError && $options.onVideoError(...args))
        }, null, 40, ["src"])
      ]),
      vue.createElementVNode("view", {
        class: "close-btn",
        onClick: _cache[1] || (_cache[1] = (...args) => $options.close && $options.close(...args))
      }, [
        vue.createElementVNode("text", null, "✕")
      ])
    ]);
  }
  const PagesMessageVideoPlayer = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__scopeId", "data-v-12a678ea"], ["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/pages/message/video-player.vue"]]);
  __definePage("pages/index/index", PagesIndexIndex);
  __definePage("pages/message/index", PagesMessageIndex);
  __definePage("pages/item/publish", PagesItemPublish);
  __definePage("pages/user/index", PagesUserIndex);
  __definePage("pages/auth/login", PagesAuthLogin);
  __definePage("pages/auth/register", PagesAuthRegister);
  __definePage("pages/item/detail", PagesItemDetail);
  __definePage("pages/message/chat", PagesMessageChat);
  __definePage("pages/user/my-items", PagesUserMyItems);
  __definePage("pages/user/my-collection", PagesUserMyCollection);
  __definePage("pages/user/edit", PagesUserEdit);
  __definePage("pages/user/settings", PagesUserSettings);
  __definePage("pages/user/blocked-users", PagesUserBlockedUsers);
  __definePage("pages/message/video-player", PagesMessageVideoPlayer);
  function getAppVersion() {
    try {
      if (typeof plus !== "undefined" && plus && plus.runtime) {
        return plus.runtime.versionCode || "";
      }
    } catch (e) {
      formatAppLog("error", "at App.vue:43", "获取版本号失败:", e);
    }
    return "";
  }
  const _sfc_main = {
    onLaunch: function() {
      formatAppLog("log", "at App.vue:51", "App Launch");
      this.setGlobalDarkMode();
      try {
        formatAppLog("log", "at App.vue:58", "启动心跳检测");
        api.resetHeartbeat();
      } catch (e) {
        formatAppLog("error", "at App.vue:61", "启动心跳失败:", e);
      }
      uni.reLaunch({ url: "/pages/index/index" });
      const initPlusApp = () => {
        try {
          if (typeof plus === "undefined" || !plus || !plus.runtime) {
            setTimeout(initPlusApp, 100);
            return;
          }
          const _self = this;
          if (plus.push) {
            plus.push.addEventListener("click", function(msg) {
              try {
                const payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload;
                if (payload && payload.userId) {
                  uni.navigateTo({
                    url: `/pages/message/chat?userId=${payload.userId}&userName=${encodeURIComponent(payload.userName || "")}`
                  });
                }
              } catch (e) {
                formatAppLog("error", "at App.vue:89", "push click parse error", e);
              }
            });
          }
          if (plus.runtime) {
            plus.runtime.setBadgeNumber(0);
          }
          this.checkUpdate();
        } catch (e) {
          formatAppLog("error", "at App.vue:102", "初始化plus失败:", e);
        }
      };
      setTimeout(initPlusApp, 500);
    },
    onShow: function() {
      formatAppLog("log", "at App.vue:111", "App Show");
      try {
        if (typeof plus !== "undefined" && plus && plus.runtime) {
          plus.runtime.setBadgeNumber(0);
        }
      } catch (e) {
        formatAppLog("error", "at App.vue:118", "onShow设置角标失败:", e);
      }
    },
    onHide: function() {
      formatAppLog("log", "at App.vue:123", "App Hide");
    },
    onUnload: function() {
      formatAppLog("log", "at App.vue:127", "App Unload");
      try {
        if (api && api.stopHeartbeat) {
          api.stopHeartbeat();
        }
      } catch (e) {
        formatAppLog("error", "at App.vue:134", "停止心跳失败:", e);
      }
    },
    methods: {
      // 检测版本更新（仅 App 平台）
      async checkUpdate() {
        try {
          const apiBase = "http://183.66.27.20:41412";
          const res = await uni.request({ url: `${apiBase}/version/latest` });
          if (res.statusCode !== 200 || !res.data || !res.data.data)
            return;
          const latest = res.data.data;
          const currentCode = parseInt(getAppVersion()) || 0;
          if (latest.versionCode > currentCode) {
            const modalRes = await uni.showModal({
              title: `发现新版本 v${latest.version}`,
              content: latest.changelog || "点击确定前往下载页面",
              confirmText: "立即更新",
              showCancel: !latest.forceUpdate
            });
            if (modalRes.confirm) {
              const downloadUrl = `${apiBase}/download`;
              try {
                if (typeof plus !== "undefined" && plus && plus.runtime) {
                  plus.runtime.openURL(downloadUrl);
                }
              } catch (e) {
                formatAppLog("error", "at App.vue:166", "打开URL失败:", e);
              }
            }
            if (latest.forceUpdate && !modalRes.confirm) {
              try {
                if (typeof plus !== "undefined" && plus && plus.runtime) {
                  plus.runtime.quit();
                }
              } catch (e) {
                formatAppLog("error", "at App.vue:176", "退出App失败:", e);
              }
            }
          }
        } catch (e) {
          formatAppLog("error", "at App.vue:181", "版本检测失败", e);
        }
      },
      // 设置全局深色模式
      setGlobalDarkMode() {
        try {
          if (typeof plus !== "undefined" && plus.navigator) {
            plus.navigator.setStatusBarStyle("light");
            plus.navigator.setStatusBarBackground("#1a1a1a");
            if (plus.navigator.setNavigationBarColor) {
              plus.navigator.setNavigationBarColor("#1a1a1a");
            }
          }
        } catch (e) {
          formatAppLog("error", "at App.vue:200", "设置深色模式失败:", e);
        }
      }
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "C:/Users/zhuzhu/Desktop/zhuzhucalled/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
    return {
      app
    };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
