import type { ScenarioId } from "@/lib/types";

export type UiLanguage = "zh" | "ja" | "en";

export const languageOptions: Array<{ id: UiLanguage; label: string }> = [
  { id: "ja", label: "日本語" },
  { id: "en", label: "English" },
  { id: "zh", label: "中文" }
];

export const htmlLang: Record<UiLanguage, string> = {
  ja: "ja",
  en: "en",
  zh: "zh-CN"
};

export const uiCopy = {
  ja: {
    newChat: "新規チャット",
    memory: "メモリー",
    chatHistory: "チャット履歴",
    delete: "削除",
    emptyHistory: "最初のメッセージを送ると、ここに会話が表示されます。",
    helpLabel: "説明",
    languageLabel: "言語",
    helpIntro: "使えること",
    helpItems: [
      "買い物：条件に合う商品を探し、価格・レビュー・商品ページを確認できます。",
      "外出：場所と天気を見て、雨なら屋内、晴れなら歩きやすい候補を提案します。",
      "地図：候補の場所をすぐ開けます。",
      "メモリー：残した好みを次の相談に反映します。"
    ],
    languageTitle: "言語",
    selected: "選択中",
    clickToFill: "例文を使う",
    tasks: {
      shopping: {
        title: "商品を探す",
        prompt:
          "来月から一人暮らしを始めるので、2万円以内で電子レンジを探して。レビューが良くて、省スペースなものがいい。"
      },
      outing: {
        title: "おでかけ先を決める",
        prompt:
          "土曜日に渋谷で友達と会う。雨なら屋内、晴れなら散歩できる場所を提案して。"
      }
    },
    memoryIntro:
      "あなたが残した好みを表示します。次の依頼を、より近い条件で考えるために使います。",
    memoryEmpty: "まだ保存された好みはありません。",
    update: "更新",
    updating: "更新中",
    updateFailed: "更新失敗",
    preview: "プレビュー",
    edit: "編集",
    assistantRunning: "実行中",
    assistantPending: "依頼を整理し、必要な情報を確認しています…",
    conclusionLabel: "結論",
    sourceLabel: "Yahoo! JAPAN の取得結果",
    recommendationTitle: {
      shopping: "おすすめ商品",
      outing: "近くの候補"
    },
    feedbackQuestion: "この回答は役に立ちましたか？",
    helpful: "役に立った",
    notHelpful: "改善が必要",
    feedbackThanks: "フィードバックを記録しました",
    stepStatus: {
      done: "完了",
      running: "実行中",
      waiting: "待機中"
    },
    composerPlaceholder: "条件や希望を入力してください",
    send: "送信",
    apiErrorSummary:
      "情報の取得に失敗しました。しばらく待ってから、もう一度お試しください。",
    apiErrorStatus: "接続失敗",
    logTitle: "実行ログ",
    logSubtitle: "判断とデータ取得の流れ",
    noActiveRun: "実行なし",
    startedAt: "開始",
    planSteps: "実行トレース",
    toolCalls: "ツール呼び出し",
    approvalHistory: "承認履歴",
    memoryUpdates: "メモリー更新",
    memoryKind: {
      add: "追加",
      update: "更新"
    },
    noMemory: "まだ保存された好みはありません。",
    toolStatus: {
      success: "成功",
      waiting: "待機",
      error: "エラー"
    },
    approvalStatus: {
      pending: "承認待ち",
      approved: "承認済み",
      declined: "却下"
    },
    agentTitle: {
      shopping: "Shopping agent",
      outing: "Weather agent"
    }
  },
  en: {
    newChat: "New chat",
    memory: "Memory",
    chatHistory: "Chat history",
    delete: "Delete",
    emptyHistory: "Send a first message and the conversation will appear here.",
    helpLabel: "Help",
    languageLabel: "Language",
    helpIntro: "What this can do",
    helpItems: [
      "Shopping: find matching products, then review prices, ratings, and product pages.",
      "Outings: use place and weather context to suggest indoor or walkable options.",
      "Maps: open each suggested place directly.",
      "Memory: reuse preferences you choose to keep for the next request."
    ],
    languageTitle: "Language",
    selected: "Selected",
    clickToFill: "Use example",
    tasks: {
      shopping: {
        title: "Find a product",
        prompt:
          "I am moving into my first apartment next month. Find a compact microwave under 20,000 yen with good reviews."
      },
      outing: {
        title: "Plan an outing",
        prompt:
          "I am meeting a friend in Shibuya on Saturday. If it rains, suggest indoor options; if it is sunny, suggest somewhere walkable."
      }
    },
    memoryIntro:
      "Shows preferences you chose to keep, so the next request can start closer to your needs.",
    memoryEmpty: "No saved preferences yet.",
    update: "Update",
    updating: "Updating",
    updateFailed: "Update failed",
    preview: "Preview",
    edit: "Edit",
    assistantRunning: "Running",
    assistantPending: "Organizing your request and checking the information you need…",
    conclusionLabel: "Answer",
    sourceLabel: "Results from Yahoo! JAPAN",
    recommendationTitle: {
      shopping: "Recommended products",
      outing: "Nearby options"
    },
    feedbackQuestion: "Was this answer useful?",
    helpful: "Helpful",
    notHelpful: "Needs improvement",
    feedbackThanks: "Feedback recorded",
    stepStatus: {
      done: "Done",
      running: "Running",
      waiting: "Waiting"
    },
    composerPlaceholder: "Describe what you need",
    send: "Send",
    apiErrorSummary: "Could not fetch the information. Please wait a moment and try again.",
    apiErrorStatus: "Connection failed",
    logTitle: "Execution log",
    logSubtitle: "Decision and data retrieval flow",
    noActiveRun: "No active run",
    startedAt: "Started",
    planSteps: "Execution trace",
    toolCalls: "Tool calls",
    approvalHistory: "Approval history",
    memoryUpdates: "Memory updates",
    memoryKind: {
      add: "Add",
      update: "Update"
    },
    noMemory: "No saved preferences yet.",
    toolStatus: {
      success: "success",
      waiting: "waiting",
      error: "error"
    },
    approvalStatus: {
      pending: "pending",
      approved: "approved",
      declined: "declined"
    },
    agentTitle: {
      shopping: "Shopping agent",
      outing: "Weather agent"
    }
  },
  zh: {
    newChat: "新聊天",
    memory: "记忆",
    chatHistory: "聊天历史",
    delete: "删除",
    emptyHistory: "发送第一条消息后，对话会出现在这里。",
    helpLabel: "说明",
    languageLabel: "语言",
    helpIntro: "可以做这些事",
    helpItems: [
      "购物：按条件查找商品，并查看价格、评价和商品页。",
      "外出：结合地点和天气，推荐室内或适合步行的方案。",
      "地图：直接打开每个候选地点。",
      "记忆：把你保留的偏好用于下一次请求。"
    ],
    languageTitle: "语言",
    selected: "已选择",
    clickToFill: "使用示例",
    tasks: {
      shopping: {
        title: "查找商品",
        prompt: "我下个月开始一个人住，想找 2 万日元以内的电子微波炉。希望评价好、省空间。"
      },
      outing: {
        title: "决定外出地点",
        prompt:
          "周六要在涩谷和朋友见面。如果下雨就推荐室内方案，如果晴天就推荐适合散步的地方。"
      }
    },
    memoryIntro: "这里显示你保留下来的偏好。下一次请求时，会用它来更接近你的条件。",
    memoryEmpty: "还没有保存偏好。",
    update: "更新",
    updating: "更新中",
    updateFailed: "更新失败",
    preview: "预览",
    edit: "编辑",
    assistantRunning: "运行中",
    assistantPending: "正在整理需求并确认所需信息…",
    conclusionLabel: "结论",
    sourceLabel: "来自 Yahoo! JAPAN 的结果",
    recommendationTitle: {
      shopping: "推荐商品",
      outing: "附近候选"
    },
    feedbackQuestion: "这次回答有帮助吗？",
    helpful: "有帮助",
    notHelpful: "需要改进",
    feedbackThanks: "已记录反馈",
    stepStatus: {
      done: "完成",
      running: "运行中",
      waiting: "等待中"
    },
    composerPlaceholder: "输入你的条件或希望",
    send: "发送",
    apiErrorSummary: "信息获取失败。请稍后再试。",
    apiErrorStatus: "连接失败",
    logTitle: "执行日志",
    logSubtitle: "判断与数据获取流程",
    noActiveRun: "暂无运行",
    startedAt: "开始",
    planSteps: "执行轨迹",
    toolCalls: "工具调用",
    approvalHistory: "确认记录",
    memoryUpdates: "记忆更新",
    memoryKind: {
      add: "添加",
      update: "更新"
    },
    noMemory: "还没有保存偏好。",
    toolStatus: {
      success: "成功",
      waiting: "等待",
      error: "错误"
    },
    approvalStatus: {
      pending: "待确认",
      approved: "已确认",
      declined: "已拒绝"
    },
    agentTitle: {
      shopping: "Shopping agent",
      outing: "Weather agent"
    }
  }
};

export type UiCopy = (typeof uiCopy)[UiLanguage];

export function getRecommendationTitle(copy: UiCopy, scenario: ScenarioId) {
  return copy.recommendationTitle[scenario];
}
