<template>
  <view v-if="visible" class="guide-overlay" @click="handleOverlayClick">
    <view class="guide-card" @click.stop>
      <!-- 步骤图标 -->
      <view class="guide-icon">{{ currentStep.icon }}</view>

      <!-- 步骤标题 -->
      <text class="guide-title">{{ currentStep.title }}</text>

      <!-- 步骤描述 -->
      <text class="guide-desc">{{ currentStep.desc }}</text>

      <!-- 步骤指示器 -->
      <view class="guide-dots">
        <view
          v-for="(step, idx) in steps"
          :key="idx"
          class="guide-dot"
          :class="{ active: idx === stepIndex, done: idx < stepIndex }"
        ></view>
      </view>

      <!-- 底部按钮 -->
      <view class="guide-btns">
        <text class="guide-skip" @click="close">跳过</text>
        <view class="guide-right">
          <text
            v-if="stepIndex > 0"
            class="guide-btn guide-btn-prev"
            @click="prev"
          >上一步</text>
          <text
            class="guide-btn guide-btn-next"
            @click="next"
          >{{ stepIndex < steps.length - 1 ? '下一步' : '开始使用' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { storage } from '@/utils/storage'

const GUIDE_KEY = 'guide_shown'

export default {
  name: 'GuideModal',
  data() {
    return {
      visible: false,
      stepIndex: 0,
      steps: [
        {
          icon: '🏠',
          title: '浏览失物招领',
          desc: '在首页可以看到所有同学发布的寻物启事和失物招领信息。\n\n点击顶部搜索框可以按关键词搜索，切换标签可以筛选"全部"、"寻物"或"招领"类型。'
        },
        {
          icon: '🔍',
          title: '筛选与搜索',
          desc: '点击分类标签（全部/寻物启事/失物招领）可以快速筛选。\n\n使用时间筛选（今天/本周/本月）可以缩小范围。\n\n输入关键词搜索你关心的物品。'
        },
        {
          icon: '📝',
          title: '发布信息',
          desc: '点击底部导航栏的"+"号，进入发布页面。\n\n填写物品标题、描述、类型（寻物/招领）、联系方式等信息。\n\n可以上传最多5张图片，方便他人辨认。'
        },
        {
          icon: '💬',
          title: '私信沟通',
          desc: '在物品详情页点击"联系发布者"，可以发送私信。\n\n支持文字、图片和视频消息。\n\n消息页面的"消息"标签会显示未读消息红点，点击即可进入聊天。'
        },
        {
          icon: '👤',
          title: '个人中心',
          desc: '点击底部"我的"进入个人中心。\n\n可以编辑头像、昵称等资料，查看自己发布的物品，管理黑名单。\n\n如有问题请联系管理员。'
        }
      ]
    }
  },
  computed: {
    currentStep() {
      return this.steps[this.stepIndex] || this.steps[0]
    }
  },
  methods: {
    show() {
      this.stepIndex = 0
      this.visible = true
    },
    close() {
      this.visible = false
      storage.setSettings({ ...storage.getSettings(), [GUIDE_KEY]: true })
    },
    prev() {
      if (this.stepIndex > 0) this.stepIndex--
    },
    next() {
      if (this.stepIndex < this.steps.length - 1) {
        this.stepIndex++
      } else {
        this.close()
      }
    },
    handleOverlayClick() {
      // 点击蒙层不关闭，防止误操作
    }
  }
}
</script>

<style lang="scss" scoped>
.guide-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60rpx;
}

.guide-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 50rpx 40rpx 36rpx;
  width: 100%;
  max-width: 600rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.guide-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.guide-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 20rpx;
  text-align: center;
}

.guide-desc {
  font-size: 26rpx;
  color: #666;
  line-height: 1.8;
  text-align: center;
  white-space: pre-line;
  min-height: 180rpx;
}

.guide-dots {
  display: flex;
  gap: 12rpx;
  margin: 30rpx 0;
}

.guide-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #e0e0e0;
  transition: all 0.3s;

  &.active {
    width: 36rpx;
    border-radius: 7rpx;
    background: #334155;
  }

  &.done {
    background: #475569;
  }
}

.guide-btns {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 10rpx;
}

.guide-skip {
  font-size: 26rpx;
  color: #999;
  padding: 16rpx;
}

.guide-right {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.guide-btn {
  font-size: 28rpx;
  padding: 16rpx 36rpx;
  border-radius: 36rpx;
  font-weight: 500;
}

.guide-btn-prev {
  color: #334155;
  background: #e5e7eb;
}

.guide-btn-next {
  color: #fff;
  background: #334155;
}
</style>
