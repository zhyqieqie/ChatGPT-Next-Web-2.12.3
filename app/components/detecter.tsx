/* eslint-disable @next/next/no-img-element */
import { ChatMessage, ModelType, useAppConfig, useChatStore } from "../store";
import Locale from "../locales";
import styles from "./detecter.module.scss";
import {
  List,
  ListItem,
  Modal,
  Select,
  showImageModal,
  showModal,
  showToast,
} from "./ui-lib";
import { IconButton } from "./button";
import {
  copyToClipboard,
  downloadAs,
  getMessageImages,
  useMobileScreen,
} from "../utils";

import CopyIcon from "../icons/copy.svg";
import LoadingIcon from "../icons/three-dots.svg";
import ChatGptIcon from "../icons/chatgpt.png";
import OKIcon from "../icons/OK.png";
import RejectIcon from "../icons/reject.png";
import ShareIcon from "../icons/share.svg";
import BotIcon from "../icons/bot.png";
import LoadingButtonIcon from "../icons/loading.svg";
import CheckSvg from "../icons/checked.svg";

import DownloadIcon from "../icons/download.svg";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSelector, useMessageSelector } from "./message-selector";
import { Avatar } from "./emoji";
import dynamic from "next/dynamic";
import NextImage from "next/image";

import { toBlob, toPng } from "html-to-image";
import { DEFAULT_MASK_AVATAR } from "../store/mask";

import { prettyObject } from "../utils/format";
import { EXPORT_MESSAGE_CLASS_NAME, ModelProvider } from "../constant";
import { getClientConfig } from "../config/client";
import { ClientApi } from "../client/api";
import { getMessageTextContent } from "../utils";
import { identifyDefaultClaudeModel } from "../utils/checkers";

const Markdown = dynamic(async () => (await import("./markdown")).Markdown, {
  loading: () => <LoadingIcon />,
});

let title = "一场龙争虎斗的激烈篮球赛";
let content =
  "一场别树一格的赛事让无数运动爱好者血脉贲张,尤其是吾辈同袍,更是观摩津津乐道。你猜猜看,究竟是哪两支劲旅在绿茵场上展开了一场龙争虎斗?莫急,姑且为你娓娓道来。";
/*let detectResult = {
  "baidu": "-",
  "_360": "-",
  "score": "-"
};
let risk1Result = {
  "rtype": "1",
  "action": "",
  "labelsList": []
};
let risk2Result = {
  "rtype": "2",
  "action": "",
  "labelsList": []
};
let analysisTitleResult = {
  "emotion": "-",
  "titlesection": "",
  "category1": "",
  "title": ""
};
let extractLabelResult = {
  "labelinfo":{
    "title":"",
    "labels":[{"score":"","tag":""}]},
  "category":"体育"
};*/

//let token =
//  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJVc2VySWQiOiJhODY5YTkwNS0zZWQ5LTRjNDktYTMxYi04ODhjZmNlNzEzZTgiLCJUaW1lU3BhbiI6IjIwMjQwNTA4MTExNjM0IiwibmJmIjoxNzE1MTM4MTk0LCJleHAiOjE3MTc3MzAxOTQsImlzcyI6Ill6T3BlbiIsImF1ZCI6Ill6T3BlbiJ9.j6_VTF29sK5vS90FBGG6jsCR6Dfg2r2DNjL_IUi_Oco";
let analysisUrl = "https://a.lvpao.run/a/article/articleyizhuan/";
//let analysisUrl = "http://localhost:9300/a/article/articleyizhuan/";

export function DetectMessageModal(props: { onClose: () => void }) {
  return (
    <div className="modal-mask">
      <Modal
        title="一键检测"
        onClose={props.onClose}
        footer={
          <div
            style={{
              width: "100%",
              textAlign: "center",
              fontSize: 14,
              opacity: 0.5,
            }}
          ></div>
        }
        defaultMax={true}
      >
        <div style={{ minHeight: "40vh" }}>
          <OriginalDetect />
        </div>
      </Modal>
    </div>
  );
}

function useSteps(
  steps: Array<{
    name: string;
    value: string;
  }>,
) {
  const stepCount = steps.length;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const nextStep = () =>
    setCurrentStepIndex((currentStepIndex + 1) % stepCount);
  const prevStep = () =>
    setCurrentStepIndex((currentStepIndex - 1 + stepCount) % stepCount);

  return {
    currentStepIndex,
    setCurrentStepIndex,
    nextStep,
    prevStep,
    currentStep: steps[currentStepIndex],
  };
}

function Steps<
  T extends {
    name: string;
    value: string;
  }[],
>(props: { steps: T; onStepChange?: (index: number) => void; index: number;
  riskReadyAllLoading:boolean;originalLoading:boolean;extractLabelLoading:boolean ;analysisTitleLoading:boolean}) {
  const steps = props.steps;
  const stepCount = steps.length;

  return (
    <div className={styles["steps"]}>
      <div className={styles["steps-progress"]}>
        <div
          className={styles["steps-progress-inner"]}
          style={{
            width: `${((props.index + 1) / stepCount) * 100}%`,
          }}
        ></div>
      </div>
      <div className={styles["steps-inner"]}>
        {steps.map((step, i) => {
          // @ts-ignore
          return (
              <div
                  key={i}
                  className={`${styles["step"]} ${
                      styles[i <= props.index ? "step-finished" : ""]
                  } ${i === props.index && styles["step-current"]} clickable`}
                  onClick={() => {
                    props.onStepChange?.(i);
                  }}
                  role="button"
              >
                <span className={styles["step-index"]}>{i + 1}</span>
                <span className={styles["step-name"]}>{step.name}</span>
                <IconButton
                    shadow
                    icon={(i===0?props.riskReadyAllLoading :
                        i===1?props.originalLoading:
                            i===2?props.extractLabelLoading:
                                i===3?props.analysisTitleLoading:true)?
                        <LoadingIcon /> : <CheckSvg />}
                ></IconButton>
              </div>
          );
        })}
      </div>
    </div>
  );
}

export function OriginalDetect() {
  const steps = [
    {
      name: "风险检测",
      value: "risk",
    },
    {
      name: "原创检测",
      value: "original",
    },
    {
      name: "标题分析",
      value: "titleAnalysis",
    },
    {
      name: "提取文章标签",
      value: "titleExtract",
    },
    /*{
      name: "其他检测",
      value: "preview",
    },*/
  ];
  const { currentStep, setCurrentStepIndex, currentStepIndex } =
    useSteps(steps);
  const formats = ["text", "image", "json"] as const;
  type ExportFormat = (typeof formats)[number];
  const config = useAppConfig();
  const [exportConfig, setExportConfig] = useState({
    format: "image" as ExportFormat,
    includeContext: true,
  });

  const [wordCount, setWordCount] = useState(0);

  const [loading, setLoading] = useState(false);

  const [score, setScore] = useState({
    score: "",
    _360: "",
    baidu: "",
  });
  const [listR, setListR] = useState([{ content: "", rvBaiDuStr: "" }]);
  const [risk1, setRisk1] = useState({
    rtype: "",
    action: "",
    labelsList: [{ label: "", level: "", hint: "" }],
  });

  const [risk2, setRisk2] = useState({
    rtype: "",
    action: "",
    labelsList: [{ label: "", level: "", hint: "" }],
  });

  const [analysisTitle, setAnalysisTitle] = useState({
    emotion: "",
    titlesection: "",
    category1: "",
    title: "",
    spamwords: "",
  });

  const [extractLabel, setExtractLabel] = useState({
    labelinfo: {
      title: "",
      labels: [{ score: "", tag: "" }], // 或者初始化为空数组的具体对象结构 [{score:"", tag:""}]
    },
    category: "",
  });
  const [riskReadyAllLoading, setRiskReadyAllLoading] = useState(true);
  const [extractLabelLoading, setExtractLabelLoading] = useState(true);
  const [analysisTitleLoading, setAnalysisTitleLoading] = useState(true);
  const [originalLoading, setOriginalLoading] = useState(true);

  function updateExportConfig(updater: (config: typeof exportConfig) => void) {
    const config = { ...exportConfig };
    updater(config);
    setExportConfig(config);
  }

  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const { selection, updateSelection } = useMessageSelector();
  const selectedMessages = useMemo(() => {
    const ret: ChatMessage[] = [];
    if (exportConfig.includeContext) {
      ret.push(...session.mask.context);
    }
    ret.push(...session.messages.filter((m) => selection.has(m.id)));
    return ret;
  }, [
    exportConfig.includeContext,
    session.messages,
    session.mask.context,
    selection,
  ]);
  function preview() {
    if (exportConfig.format === "text") {
      return (
        <MarkdownPreviewer messages={selectedMessages} topic={session.topic} />
      );
    } else if (exportConfig.format === "json") {
      return (
        <JsonPreviewer messages={selectedMessages} topic={session.topic} />
      );
    } else {
      return (
        <ImagePreviewer messages={selectedMessages} topic={session.topic} />
      );
    }
  }
  // 从消息队列中获取这条记录
  let userMessage = session.mask.context.pop();
  if (userMessage) {
    const textContent = userMessage.content;
    if (typeof textContent === "string") {
      const lines = textContent.split("\n");
      title = lines[0];
      content = lines.slice(1).join("\n");
    }
  }

  //const { baidu,_360,score } = detectResult;
  useEffect(() => {
    fetchData();
    //fetchOrignalData();
    //fetchRiskReadyAllData()
    //fetchAnalysisTitleData;
    //fetchextractLabelData();
  }, []);
  const fetchOrignalData = async () => {
    try {
      setOriginalLoading(true);
      const response = await fetch(analysisUrl+"original", {
        body: JSON.stringify({
          title: title,
          content: content,
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
      });
      const data = await response.json();
      //const jsonString =
      //  '{"code":0,"msg":"成功","data":{"score":{"score":"80.92","_360":"-","baidu":"80.92"},"risk2":{"rtype":"2","action":"1","labelsList":[{"level":"1","hint":"破局","label":"400"}]},"risk1":{"rtype":"1","action":"1","labelsList":[{"level":"1","hint":"破局","label":"400"}]},"analysisTitle":{"emotion":"中性","titlesection":"true","category1":"科技","title":"标题:国产旗舰手机 破局征程"},"extractLabel":{"labelinfo":{"title":"标题:国产旗舰手机 破局征程","labels":[{"score":"1.65409","tag":"高端旗舰"},{"score":"1.13363","tag":"华为"},{"score":"1.04158","tag":"小米"},{"score":"0.99395","tag":"国产"},{"score":"0.9321","tag":"国产手机"}]},"category":"科技"}}}';
      //const data = JSON.parse(jsonString);
      console.log("易撰original返回：", JSON.stringify(data));
      if (data && data.data && data.data.score) {
        setScore(data.data);
      }
      if (data && data.data && data.data.listR) {
        setListR(data.data.listR);
      }
      setWordCount(content.length);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setOriginalLoading(false);
    }
  };
  const fetchRiskReadyAllData = async () => {
    try {
      setOriginalLoading(true);
      const response = await fetch(analysisUrl+"riskReadyAll", {
        body: JSON.stringify({
          title: title,
          content: content,
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
      });
      const data = await response.json();
      //const jsonString =
      //  '{"code":0,"msg":"成功","data":{"score":{"score":"80.92","_360":"-","baidu":"80.92"},"risk2":{"rtype":"2","action":"1","labelsList":[{"level":"1","hint":"破局","label":"400"}]},"risk1":{"rtype":"1","action":"1","labelsList":[{"level":"1","hint":"破局","label":"400"}]},"analysisTitle":{"emotion":"中性","titlesection":"true","category1":"科技","title":"标题:国产旗舰手机 破局征程"},"extractLabel":{"labelinfo":{"title":"标题:国产旗舰手机 破局征程","labels":[{"score":"1.65409","tag":"高端旗舰"},{"score":"1.13363","tag":"华为"},{"score":"1.04158","tag":"小米"},{"score":"0.99395","tag":"国产"},{"score":"0.9321","tag":"国产手机"}]},"category":"科技"}}}';
      //const data = JSON.parse(jsonString);
      console.log("易撰 riskReadyAll 返回：", JSON.stringify(data));
      if (data && data.data && data.data.risk1) {
        setRisk1(data.data.risk1);
      }
      if (data && data.data && data.data.risk2) {
        setRisk2(data.data.risk2);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setRiskReadyAllLoading(false);
    }
  };
  const fetchextractLabelData = async () => {
    try {
      setOriginalLoading(true);
      const response = await fetch(analysisUrl+"extractLabel", {
        body: JSON.stringify({
          title: title,
          content: content,
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
      });
      const data = await response.json();
      //const jsonString =
      //  '{"code":0,"msg":"成功","data":{"score":{"score":"80.92","_360":"-","baidu":"80.92"},"risk2":{"rtype":"2","action":"1","labelsList":[{"level":"1","hint":"破局","label":"400"}]},"risk1":{"rtype":"1","action":"1","labelsList":[{"level":"1","hint":"破局","label":"400"}]},"analysisTitle":{"emotion":"中性","titlesection":"true","category1":"科技","title":"标题:国产旗舰手机 破局征程"},"extractLabel":{"labelinfo":{"title":"标题:国产旗舰手机 破局征程","labels":[{"score":"1.65409","tag":"高端旗舰"},{"score":"1.13363","tag":"华为"},{"score":"1.04158","tag":"小米"},{"score":"0.99395","tag":"国产"},{"score":"0.9321","tag":"国产手机"}]},"category":"科技"}}}';
      //const data = JSON.parse(jsonString);
      console.log("易撰extractLabel返回：", JSON.stringify(data));
      if (data && data.data && data.data.extractLabel) {
        setExtractLabel(data.data.extractLabel);
      }
    } catch (error) {
      console.error("Error fetching extractLabel data:", error);
    } finally {
      setExtractLabelLoading(false);
    }
  };
  const fetchAnalysisTitleData = async () => {
    try {
      setOriginalLoading(true);
      const response = await fetch(analysisUrl+"analysisTitle", {
        body: JSON.stringify({
          title: title,
          content: content,
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
      });
      const data = await response.json();
      //const jsonString =
      //  '{"code":0,"msg":"成功","data":{"score":{"score":"80.92","_360":"-","baidu":"80.92"},"risk2":{"rtype":"2","action":"1","labelsList":[{"level":"1","hint":"破局","label":"400"}]},"risk1":{"rtype":"1","action":"1","labelsList":[{"level":"1","hint":"破局","label":"400"}]},"analysisTitle":{"emotion":"中性","titlesection":"true","category1":"科技","title":"标题:国产旗舰手机 破局征程"},"extractLabel":{"labelinfo":{"title":"标题:国产旗舰手机 破局征程","labels":[{"score":"1.65409","tag":"高端旗舰"},{"score":"1.13363","tag":"华为"},{"score":"1.04158","tag":"小米"},{"score":"0.99395","tag":"国产"},{"score":"0.9321","tag":"国产手机"}]},"category":"科技"}}}';
      //const data = JSON.parse(jsonString);
      console.log("易撰 analysisTitle 返回：", JSON.stringify(data));

      if (data && data.data && data.data.analysisTitle) {
        setAnalysisTitle(data.data.analysisTitle);
      }
    } catch (error) {
      console.error("Error fetching analysisTitle data:", error);
    } finally {
      setAnalysisTitleLoading(false);
    }
  };
  const fetchData = async () => {
    try {
      setRiskReadyAllLoading(true);
      setOriginalLoading(true);
      setExtractLabelLoading(true);
      setAnalysisTitleLoading(true);
      const response = await fetch(analysisUrl+"analysis", {
        body: JSON.stringify({
          title: title,
          content: content,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = await response.json();
      /*const jsonString =
        '{"code":0,"msg":"成功","data":{"score":{"score":"10.24","_360":"-","baidu":"10.24"},"risk2":{"rtype":"2","action":"2","labelsList":[{"level":"2","hint":"主席-习近平","label":"400"}]},"risk1":{"rtype":"1","action":"2","labelsList":[]},"analysisTitle":{"emotion":"积极","titlesection":"false","category1":"历史","title":"中国元首出访"},"listR":[{"rvBaiDuStr":"92.39 %","content":"今年中国元首出访的开篇之作，选择了欧洲。立夏之后的这一周，越过辽阔的亚欧大陆"},{"rvBaiDuStr":"87.13 %","content":"是跬步江山的相向而行，是“中国式现代化将给世界带来巨大机遇”的壮阔图景。当地"}],"extractLabel":{"labelinfo":{"title":"中国元首出访","labels":[{"score":"1.06585","tag":"中塞命运"},{"score":"0.86958","tag":"欧洲"},{"score":"0.78666","tag":"共同体"},{"score":"0.71141","tag":"互鉴"},{"score":"0.69113","tag":"政要"}]},"category":"国际"}}}';
      const data = JSON.parse(jsonString);*/
      console.log("易撰返回：", JSON.stringify(data));
      if (data && data.data && data.data.risk1) {
        setRisk1(data.data.risk1);
      }
      if (data && data.data && data.data.risk2) {
        setRisk2(data.data.risk2);
      }
      if (data && data.data && data.data.score) {
        setScore(data.data.score);
      }
      if (data && data.data && data.data.analysisTitle) {
        setAnalysisTitle(data.data.analysisTitle);
      }
      if (data && data.data && data.data.extractLabel) {
        setExtractLabel(data.data.extractLabel);
      }
      if (data && data.data && data.data.listR) {
        setListR(data.data.listR);
      }
      setWordCount(content.length);
      showToast("检测完成");
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setRiskReadyAllLoading(false);
      setOriginalLoading(false);
      setExtractLabelLoading(false);
      setAnalysisTitleLoading(false);
    }
  };

  let matchedItem;
  return (
    <>
      <List>
        <ListItem className={styles["original-result-value"]} title="标题：">
          <span>{analysisTitle.title}</span>
          <span className={styles["detect-value"]}>字符数：</span>
          <span>{wordCount}</span>
        </ListItem>
        <ListItem className={styles["original-result-value"]} title="风险检测">
          <span className={styles["detect-value"]}>
            {risk1.rtype ? "检测完毕，" : "-"}
          </span>
          <span>
            {risk1.action === "0" && risk2.action === "0" ? "无风险" : ""}
          </span>
          <span style={{ color: "red" }}>
            {risk1.action === "1" || risk2.action === "1" ? "有风险" : ""}
          </span>
          <span style={{color:"red"}}>
            {(risk1.action === "0" && risk2.action === "2") ||
            (risk1.action === "2" && risk2.action === "0") ||
            (risk1.action === "2" && risk2.action === "2")
              ? "有违规"
              : ""}
          </span>
        </ListItem>
        <ListItem className={styles["original-result-value"]} title="原创分值">
          <span className={styles["detect-value"]} style={{ color: "red" }}>
            {score.score}&nbsp;%
          </span>
        </ListItem>
        <ListItem className={styles["original-result-value"]} title="标题分析">
          <span className={styles["detect-value"]}>情感描述：</span>
          <span style={{ color: "rgb(29, 147, 171)" }}>
            {analysisTitle.emotion}
          </span>
          <span className={styles["detect-value"]}>几段式标题：</span>
          <span style={{ color: "rgb(29, 147, 171)" }}>
            {analysisTitle.titlesection === "false"
              ? "该标题不为三段式和四段式标题"
              : "该标题为三段式和四段式标题"}
          </span>
          <span className={styles["detect-value"]}>含有违禁词：</span>
          <span style={{ color: "rgb(29, 147, 171)" }}>
            {analysisTitle.spamwords}
          </span>
        </ListItem>
        <ListItem
          className={styles["original-result-value"]}
          title="文章标签/领域"
        >
          <span className={styles["detect-value"]}>标签：</span>
          <div style={{ display: "flex" }}>
            {extractLabel.labelinfo.labels.map((m) => (
              <div key={m.tag}>
                <span style={{ marginLeft: 10 }}>{m.tag}</span>
                <span style={{ color: "red" }}>(权重{m.score})</span>
              </div>
            ))}
          </div>
          <span className={styles["detect-value"]}>
            领域:{extractLabel.category}
          </span>
        </ListItem>
      </List>
      <Steps
        steps={steps}
        index={currentStepIndex}
        onStepChange={setCurrentStepIndex}
        riskReadyAllLoading={riskReadyAllLoading}
        originalLoading={originalLoading}
        extractLabelLoading={extractLabelLoading}
        analysisTitleLoading={analysisTitleLoading}
      />
      {/*风险检测过程*/}
      {currentStep.value === "risk" && (
        <div className={styles["original-detect-wrap"]}>
          <div className={styles["original-detect-item"]}>
            {risk1 && risk1.labelsList && risk1.labelsList.length > 0
                ? <NextImage src={RejectIcon.src} alt="logo" width={16} height={16} />
                : <NextImage src={OKIcon.src} alt="logo" width={16} height={16} />}
            <div className={styles["original-detect-item-provide"]}>
              检测标题是否存在：
            </div>
            <div style={{ color: "rgb(29, 147, 171)" }}>
              {risk1.labelsList ? "违规风险" : ""}
            </div>
            <div className={styles["original-detect-item"]}>
              <div>
                {!(risk1 && risk1.labelsList && risk1.labelsList.length > 0)
                  ? "未发现"
                  : ""}
              </div>
              <div style={{ display: "flex"  ,color:"red"}}>
                {risk1 && risk1.labelsList && risk1.labelsList.length > 0
                  ? "风险词：" + risk1.labelsList[0].hint
                  : ""}
              </div>
            </div>
          </div>
          <div className={styles["original-detect-item"]}>

            {risk1 && risk1.labelsList && risk1.labelsList.length > 1
                ? <NextImage src={RejectIcon.src} alt="logo" width={16} height={16} />
                : <NextImage src={OKIcon.src} alt="logo" width={16} height={16} />}
            <div className={styles["original-detect-item-provide"]}>
              检测标题是否存在：
            </div>
            <div style={{ color: "rgb(29, 147, 171)" }}>
              {risk1.labelsList ? "敏感信息" : ""}
            </div>
            <div className={styles["original-detect-item"]}>
              <div>
                {!(risk1 && risk1.labelsList && risk1.labelsList.length > 1)
                  ? "未发现"
                  : ""}
              </div>
              <div style={{ display: "flex" }}>
                {risk1 && risk1.labelsList && risk1.labelsList.length > 1
                  ? "风险词：" + risk1.labelsList[1].hint
                  : ""}
              </div>
            </div>
          </div>
          <div className={styles["original-detect-item"]}>
            {risk2 &&
            risk2.labelsList &&
            (matchedItem = risk2.labelsList.find(
                (item) => item.label === "200",
            ))
                ? <NextImage src={RejectIcon.src} alt="logo" width={16} height={16} />
                : <NextImage src={OKIcon.src} alt="logo" width={16} height={16} />}
            <div className={styles["original-detect-item-provide"]}>
              检测文章内容是否包含：
            </div>
            <div style={{ color: "rgb(29, 147, 171)" }}>
              {risk2.labelsList ? "广告垃圾信息" : ""}
            </div>
            <div className={styles["original-detect-item"]}>
              <div>
                {!(
                  risk2 &&
                  risk2.labelsList &&
                  risk2.labelsList.some((item) => item.label === "200")
                )
                  ? "未发现"
                  : ""}
              </div>
              <div style={{ display: "flex" }}>
                {risk2 &&
                risk2.labelsList &&
                (matchedItem = risk2.labelsList.find(
                  (item) => item.label === "200",
                ))
                  ? "风险词：" + matchedItem.hint
                  : ""}
              </div>
            </div>
          </div>
          <div className={styles["original-detect-item"]}>
            {risk2 &&
            risk2.labelsList &&
            (matchedItem = risk2.labelsList.find(
                (item) => item.label === "100",
            ))
                ? <NextImage src={RejectIcon.src} alt="logo" width={16} height={16} />
                : <NextImage src={OKIcon.src} alt="logo" width={16} height={16} />}

            <div className={styles["original-detect-item-provide"]}>
              检测文章内容是否包含：
            </div>
            <div style={{ color: "rgb(29, 147, 171)" }}>
              {risk2.labelsList ? "色情垃圾信息" : ""}
            </div>
            <div className={styles["original-detect-item"]}>
              <div>
                {!(
                  risk2 &&
                  risk2.labelsList &&
                  risk2.labelsList.some((item) => item.label === "100")
                )
                  ? "未发现"
                  : ""}
              </div>
              <div style={{ display: "flex" ,color:"red" }}>
                {risk2 &&
                risk2.labelsList &&
                (matchedItem = risk2.labelsList.find(
                  (item) => item.label === "100",
                ))
                  ? "风险词：" + matchedItem.hint
                  : ""}
              </div>
            </div>
          </div>
          <div className={styles["original-detect-item"]}>
            {risk2 &&
            risk2.labelsList &&
            (matchedItem = risk2.labelsList.find(
                (item) => item.label === "400",
            ))
                ? <NextImage src={RejectIcon.src} alt="logo" width={16} height={16} />
                : <NextImage src={OKIcon.src} alt="logo" width={16} height={16} />}

            <div className={styles["original-detect-item-provide"]}>
              检测文章内容是否包含：
            </div>
            <div style={{ color: "rgb(29, 147, 171)" }}>
              {risk2.labelsList ? "违禁涉政信息" : ""}
            </div>
            <div className={styles["original-detect-item"]}>
              <div>
                {!(
                  risk2 &&
                  risk2.labelsList &&
                  risk2.labelsList.some((item) => item.label === "400")
                )
                  ? "未发现"
                  : ""}
              </div>
              <div style={{ display: "flex" ,color:"red"}}>
                {risk2 &&
                risk2.labelsList &&
                (matchedItem = risk2.labelsList.find(
                  (item) => item.label === "400",
                ))
                  ? "风险词：" + matchedItem.hint
                  : ""}
              </div>
            </div>
          </div>
          <div className={styles["original-detect-item"]}>

            {risk2 &&
            risk2.labelsList &&
            (matchedItem = risk2.labelsList.find((item) =>
                ["600", "700"].includes(item.label),
            ))
                ? <NextImage src={RejectIcon.src} alt="logo" width={16} height={16} />
                : <NextImage src={OKIcon.src} alt="logo" width={16} height={16} />}
            <div className={styles["original-detect-item-provide"]}>
              检测文章内容是否包含：
            </div>
            <div style={{ color: "rgb(29, 147, 171)" }}>
              {risk2.labelsList ? "谩骂、灌水等垃圾信息" : ""}
            </div>
            <div className={styles["original-detect-item"]}>
              <div>
                {!(
                  risk2 &&
                  risk2.labelsList &&
                  risk2.labelsList.some((item) =>
                    ["600", "700"].includes(item.label),
                  )
                )
                  ? "未发现"
                  : ""}
              </div>
              <div style={{ display: "flex" ,color:"red" }}>
                {risk2 &&
                risk2.labelsList &&
                (matchedItem = risk2.labelsList.find((item) =>
                  ["600", "700"].includes(item.label),
                ))
                  ? "风险词：" + matchedItem.hint
                  : ""}
              </div>
            </div>
          </div>
        </div>
      )}
      {/*原创检测过程*/}
      {currentStep.value === "original" && (
        <div style={{ marginTop: 20 }}>
          <List>
            <ListItem
              title="检测语句"
              className={styles["original-detect-title"]}
            >
              <span>百度 相识度</span>
            </ListItem>
            {listR.map((m) => (
              <div key={m.content}>
                <ListItem title={m.content}>
                  <span>{m.rvBaiDuStr}</span>
                </ListItem>
              </div>
            ))}
          </List>
        </div>
      )}
      {currentStep.value === "titleAnalysis" && (
        <div style={{ marginTop: 20 }}>
          <List>
            <ListItem title="文章标题：">
              <span>{analysisTitle.title}</span>
            </ListItem>
            <ListItem title="情感描述：">
              <span>{analysisTitle.emotion}</span>
            </ListItem>
            <ListItem title="几段式标题：">
              <span>
                {analysisTitle.titlesection === "false"
                  ? "该标题不为三段式和四段式标题"
                  : "该标题为三段式和四段式标题"}
              </span>
            </ListItem>
            <ListItem title="含有违禁词：">
              <span>
                {analysisTitle.spamwords
                  ? analysisTitle.spamwords
                  : "没有违禁词"}
              </span>
            </ListItem>
          </List>
        </div>
      )}
      {currentStep.value === "titleExtract" && (
        <div style={{ marginTop: 20 }}>
          <List>
            <ListItem title="领域:">
              <span>{extractLabel.category}</span>
            </ListItem>
            <div style={{ marginTop: 20 }}></div>
            <ListItem
              title="关键字"
              className={styles["original-detect-title"]}
            >
              <span>权重</span>
            </ListItem>
            {extractLabel.labelinfo.labels.map((m, i) => (
              // eslint-disable-next-line react/jsx-key
              <div>
                <ListItem title={m.tag}>
                  <span>{m.score}</span>
                </ListItem>
              </div>
            ))}
          </List>
        </div>
      )}
      <div
        className={styles["message-exporter-body"]}
        style={currentStep.value !== "original" ? { display: "none" } : {}}
      ></div>
      {currentStep.value === "preview" && (
        <div className={styles["message-exporter-body"]}>{preview()}</div>
      )}
      {currentStep.value === "preview" && (
        <div className={styles["message-exporter-body"]}>{preview()}</div>
      )}
    </>
  );
}

export function RenderExport(props: {
  messages: ChatMessage[];
  onRender: (messages: ChatMessage[]) => void;
}) {
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!domRef.current) return;
    const dom = domRef.current;
    const messages = Array.from(
      dom.getElementsByClassName(EXPORT_MESSAGE_CLASS_NAME),
    );

    if (messages.length !== props.messages.length) {
      return;
    }

    const renderMsgs = messages.map((v, i) => {
      const [role, _] = v.id.split(":");
      return {
        id: i.toString(),
        role: role as any,
        content: role === "user" ? v.textContent ?? "" : v.innerHTML,
        date: "",
      };
    });

    props.onRender(renderMsgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={domRef}>
      {props.messages.map((m, i) => (
        <div
          key={i}
          id={`${m.role}:${i}`}
          className={EXPORT_MESSAGE_CLASS_NAME}
        >
          <Markdown content={getMessageTextContent(m)} defaultShow />
        </div>
      ))}
    </div>
  );
}

export function PreviewActions(props: {
  download: () => void;
  copy: () => void;
  showCopy?: boolean;
  messages?: ChatMessage[];
}) {
  const [loading, setLoading] = useState(false);
  const [shouldExport, setShouldExport] = useState(false);
  const config = useAppConfig();
  const onRenderMsgs = (msgs: ChatMessage[]) => {
    setShouldExport(false);

    var api: ClientApi;
    if (config.modelConfig.model.startsWith("gemini")) {
      api = new ClientApi(ModelProvider.GeminiPro);
    } else if (identifyDefaultClaudeModel(config.modelConfig.model)) {
      api = new ClientApi(ModelProvider.Claude);
    } else {
      api = new ClientApi(ModelProvider.GPT);
    }

    api
      .share(msgs)
      .then((res) => {
        if (!res) return;
        showModal({
          title: Locale.Export.Share,
          children: [
            <input
              type="text"
              value={res}
              key="input"
              style={{
                width: "100%",
                maxWidth: "unset",
              }}
              readOnly
              onClick={(e) => e.currentTarget.select()}
            ></input>,
          ],
          actions: [
            <IconButton
              icon={<CopyIcon />}
              text={Locale.Chat.Actions.Copy}
              key="copy"
              onClick={() => copyToClipboard(res)}
            />,
          ],
        });
        setTimeout(() => {
          window.open(res, "_blank");
        }, 800);
      })
      .catch((e) => {
        console.error("[Share]", e);
        showToast(prettyObject(e));
      })
      .finally(() => setLoading(false));
  };

  const share = async () => {
    if (props.messages?.length) {
      setLoading(true);
      setShouldExport(true);
    }
  };

  return (
    <>
      <div className={styles["preview-actions"]}>
        {props.showCopy && (
          <IconButton
            text={Locale.Export.Copy}
            bordered
            shadow
            icon={<CopyIcon />}
            onClick={props.copy}
          ></IconButton>
        )}
        <IconButton
          text={Locale.Export.Download}
          bordered
          shadow
          icon={<DownloadIcon />}
          onClick={props.download}
        ></IconButton>
        <IconButton
          text={Locale.Export.Share}
          bordered
          shadow
          icon={loading ? <LoadingIcon /> : <ShareIcon />}
          onClick={share}
        ></IconButton>
      </div>
      <div
        style={{
          position: "fixed",
          right: "200vw",
          pointerEvents: "none",
        }}
      >
        {shouldExport && (
          <RenderExport
            messages={props.messages ?? []}
            onRender={onRenderMsgs}
          />
        )}
      </div>
    </>
  );
}

function ExportAvatar(props: { avatar: string }) {
  if (props.avatar === DEFAULT_MASK_AVATAR) {
    return (
      <img
        src={BotIcon.src}
        width={30}
        height={30}
        alt="bot"
        className="user-avatar"
      />
    );
  }

  return <Avatar avatar={props.avatar} />;
}

export function ImagePreviewer(props: {
  messages: ChatMessage[];
  topic: string;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const mask = session.mask;
  const config = useAppConfig();

  const previewRef = useRef<HTMLDivElement>(null);

  const copy = () => {
    showToast(Locale.Export.Image.Toast);
    const dom = previewRef.current;
    if (!dom) return;
    toBlob(dom).then((blob) => {
      if (!blob) return;
      try {
        navigator.clipboard
          .write([
            new ClipboardItem({
              "image/png": blob,
            }),
          ])
          .then(() => {
            showToast(Locale.Copy.Success);
            refreshPreview();
          });
      } catch (e) {
        console.error("[Copy Image] ", e);
        showToast(Locale.Copy.Failed);
      }
    });
  };

  const isMobile = useMobileScreen();

  const download = async () => {
    showToast(Locale.Export.Image.Toast);
    const dom = previewRef.current;
    if (!dom) return;

    const isApp = getClientConfig()?.isApp;

    try {
      const blob = await toPng(dom);
      if (!blob) return;

      if (isMobile || (isApp && window.__TAURI__)) {
        if (isApp && window.__TAURI__) {
          const result = await window.__TAURI__.dialog.save({
            defaultPath: `${props.topic}.png`,
            filters: [
              {
                name: "PNG Files",
                extensions: ["png"],
              },
              {
                name: "All Files",
                extensions: ["*"],
              },
            ],
          });

          if (result !== null) {
            const response = await fetch(blob);
            const buffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);
            await window.__TAURI__.fs.writeBinaryFile(result, uint8Array);
            showToast(Locale.Download.Success);
          } else {
            showToast(Locale.Download.Failed);
          }
        } else {
          showImageModal(blob);
        }
      } else {
        const link = document.createElement("a");
        link.download = `${props.topic}.png`;
        link.href = blob;
        link.click();
        refreshPreview();
      }
    } catch (error) {
      showToast(Locale.Download.Failed);
    }
  };

  const refreshPreview = () => {
    const dom = previewRef.current;
    if (dom) {
      dom.innerHTML = dom.innerHTML; // Refresh the content of the preview by resetting its HTML for fix a bug glitching
    }
  };

  return (
    <div className={styles["image-previewer"]}>
      <PreviewActions
        copy={copy}
        download={download}
        showCopy={!isMobile}
        messages={props.messages}
      />
      <div
        className={`${styles["preview-body"]} ${styles["default-theme"]}`}
        ref={previewRef}
      >
        <div className={styles["chat-info"]}>
          <div className={styles["logo"] + " no-dark"}>
            <NextImage
              src={ChatGptIcon.src}
              alt="logo"
              width={50}
              height={50}
            />
          </div>

          <div>
            <div className={styles["main-title"]}>NextChat</div>
            <div className={styles["sub-title"]}>
              github.com/Yidadaa/ChatGPT-Next-Web
            </div>
            <div className={styles["icons"]}>
              <ExportAvatar avatar={config.avatar} />
              <span className={styles["icon-space"]}>&</span>
              <ExportAvatar avatar={mask.avatar} />
            </div>
          </div>
          <div>
            <div className={styles["chat-info-item"]}>
              {Locale.Exporter.Model}: {mask.modelConfig.model}
            </div>
            <div className={styles["chat-info-item"]}>
              {Locale.Exporter.Messages}: {props.messages.length}
            </div>
            <div className={styles["chat-info-item"]}>
              {Locale.Exporter.Topic}: {session.topic}
            </div>
            <div className={styles["chat-info-item"]}>
              {Locale.Exporter.Time}:{" "}
              {new Date(
                props.messages.at(-1)?.date ?? Date.now(),
              ).toLocaleString()}
            </div>
          </div>
        </div>
        {props.messages.map((m, i) => {
          return (
            <div
              className={styles["message"] + " " + styles["message-" + m.role]}
              key={i}
            >
              <div className={styles["avatar"]}>
                <ExportAvatar
                  avatar={m.role === "user" ? config.avatar : mask.avatar}
                />
              </div>

              <div className={styles["body"]}>
                <Markdown
                  content={getMessageTextContent(m)}
                  fontSize={config.fontSize}
                  defaultShow
                />
                {getMessageImages(m).length == 1 && (
                  <img
                    key={i}
                    src={getMessageImages(m)[0]}
                    alt="message"
                    className={styles["message-image"]}
                  />
                )}
                {getMessageImages(m).length > 1 && (
                  <div
                    className={styles["message-images"]}
                    style={
                      {
                        "--image-count": getMessageImages(m).length,
                      } as React.CSSProperties
                    }
                  >
                    {getMessageImages(m).map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt="message"
                        className={styles["message-image-multi"]}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MarkdownPreviewer(props: {
  messages: ChatMessage[];
  topic: string;
}) {
  const mdText =
    `# ${props.topic}\n\n` +
    props.messages
      .map((m) => {
        return m.role === "user"
          ? `## ${Locale.Export.MessageFromYou}:\n${getMessageTextContent(m)}`
          : `## ${Locale.Export.MessageFromChatGPT}:\n${getMessageTextContent(
              m,
            ).trim()}`;
      })
      .join("\n\n");

  const copy = () => {
    copyToClipboard(mdText);
  };
  const download = () => {
    downloadAs(mdText, `${props.topic}.md`);
  };
  return (
    <>
      <PreviewActions
        copy={copy}
        download={download}
        showCopy={true}
        messages={props.messages}
      />
      <div className="markdown-body">
        <pre className={styles["export-content"]}>{mdText}</pre>
      </div>
    </>
  );
}

export function JsonPreviewer(props: {
  messages: ChatMessage[];
  topic: string;
}) {
  const msgs = {
    messages: [
      {
        role: "system",
        content: `${Locale.FineTuned.Sysmessage} ${props.topic}`,
      },
      ...props.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
  };
  const mdText = "```json\n" + JSON.stringify(msgs, null, 2) + "\n```";
  const minifiedJson = JSON.stringify(msgs);

  const copy = () => {
    copyToClipboard(minifiedJson);
  };
  const download = () => {
    downloadAs(JSON.stringify(msgs), `${props.topic}.json`);
  };

  return (
    <>
      <PreviewActions
        copy={copy}
        download={download}
        showCopy={false}
        messages={props.messages}
      />
      <div className="markdown-body" onClick={copy}>
        <Markdown content={mdText} />
      </div>
    </>
  );
}
