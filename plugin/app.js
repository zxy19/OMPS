// ==UserScript==
// @name         OMPS多人在线同播
// @namespace    https://xypp.cc/omps/
// @updateURL    https://xypp.cc/omps/app.js
// @downloadURL  https://xypp.cc/omps/app.js
// @version      4.1
// @description  OMPS多人在线同播。脚本默认对所有站点均生效。您可以在TamperMonkey=>管理面板=>OMPS多人在线同播=>设置=>用户排除中修改不想要生效的网站或直接修改源代码
// @author       小鱼飘飘
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=omofun.tv
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @grant        GM_getTab
// ==/UserScript==

(function () {
    'use strict';
    //为非油猴的直接运行方式优化
    var GM_window,GM_get,GM_set;
    if (typeof unsafeWindow != 'object') GM_window = window;
    else GM_window=unsafeWindow;
    if (typeof GM_getValue != 'function') {
        GM_get = function (key, val) {
            return GM_window.localStorage.getItem(key) || val;
        };
        GM_set = function (key, val) {
            return GM_window.localStorage.setItem(key, val);
        };
    }else{
        GM_get=GM_getValue;
        GM_set=GM_setValue;
    }
    document.body.setAttribute("data-omps-injected", "true");
    const URL = "wss://public.xypp.cc:8093";


    var ws;
    var video;

    var initFinish = false, lastTime = -1, pauseAt, globalCount = 24, toastCnt = 0, tmpLocalDelay, localDelay, initTime, videoCode = "", HASH = {};
    const css = `.omps-tip{position:absolute;top:100px;height:40px;border-radius:0 40px 40px 0;left:-300px;background-color:rgba(0,0,0,0.772);padding-left:10px;line-height:35px;color:white;max-width:100%;z-index:10000000;transition:all 1s;opacity:0}.omps-tip.open{left:0;opacity:1}.omps-tip div{display:inline;font-size: 20px;}.omps-tip .btn{color:black;background-color:#fff;border-radius:30px;padding:5px 7px;margin-right:6px;line-height:13px;box-shadow:grey 1px 1px 1px;text-align:center;display:inline-block;vertical-align:middle}.omps-tip .btn svg{height:20px;width:20px}.omps-tip .btn svg path{fill:black;}.omps-tip .btn:hover{background-color:#dcdcdc}.omps-tip .btn:active{box-shadow:inset gray 1px 1px 1px}.omps-tip .btn span{display:none}.omps-tip .btn:hover span{animation:showLabelAnim 1s linear 1s 1;animation-fill-mode:forwards;max-width:0;overflow-x:hidden;word-break:keep-all;margin:0;display:unset;padding:0;line-height:20px;overflow-y:clip;float:right}@keyframes showLabelAnim{0%{max-width:0}100%{max-width:200px}}.omps-config{z-index: 100000;max-width: calc(100% - 100px);position:absolute;top:50px;width:600px;left:50px;background-color:rgba(0,0,0,0.772);border-radius:10px;color:white;padding:20px}.omps-config input{display:block;outline:0;border:0;border-radius:5px;color:black;background-color: rgba(255,255,255,0.772);}.omps-config input:active{box-shadow:skyblue 0 0 5px 3px}.omps-config input:focus{box-shadow:skyblue 0 0 3px 1px}.omps-config input.i{height:30px;width:300px;max-width: 100%;}.omps-config input.c{height:20px;width:20px}.omps-config label{display:block;text-decoration:underline}.omps-config small{display:block;color:lightgray}.omps-config .btn{color:black;background-color:#fff;border-radius:30px;padding:5px 10px;margin-right:10px;box-shadow:grey 1px 1px 1px;text-align:center;display:inline-block;vertical-align:middle}.omps-config .btn:hover{background-color:#dcdcdc}.omps-config .btn:active{box-shadow:inset gray 1px 1px 1px}`;
    const lang = {
        join: "检测到视频，点击进入联机放映",
        reconfigure: "重新填写配置",
        quickJoin: "快速加入",
        quit: "关闭",
        setting: {
            userId: {
                label: "用户名",
                tip: "其他用户看到您的名字。请不要使用短用户名防止重名"
            },
            group: {
                label: "加入的房间ID",
                tip: "该房间ID用于同步进度。与您的朋友输入相同的房间ID且您和朋友正在观看相同的视频时，你们的进度将会被同步"
            },
            autoJoin: {
                label: "自动加入",
                tip: "勾选后，下次检测到视频将会自动进入上次填写的群组"
            },
            silent: {
                label: "静默模式",
                tip: "仅会提示您失去同步消息，不会提示您成功消息"
            },
            saveExit: "保存并关闭",
            saveJoin: "保存并连接"
        },
        conErr: "无法连接到服务器，请刷新页面重试",
        pauseMsg: "有一位朋友的视频太慢了，等他一下...",
        playFail: "未能正确的开始播放视频！您需要手动点击播放按钮，否则您的好友可能需要等待您",
        delay: ["延迟达到了", "ms，可能会影响您或其他人的观影体验"],
        success: "连接成功，延迟",
        syncSuccess: "同步进度完成",
        playerJoin: "加入了放映厅",
        sync: "同步",
        call: "集合",
        unsync: ["失去同步！您可以同步至", "的最快进度(", "s)或者呼叫其他用户集合"],
        unsync_top: "失去同步！您是目前的最快进度，您可以呼叫其他用户集合"
    }


    //===========设置相关============
    var setting = {
        autoJoin: "",
        userId: parseInt(Math.random() * 10000),
        group: "",
        silent: ""
    };
    //导入设置（TamporMonkey/LocalStorage）
    for (const settingItem in setting) {
        if (Object.hasOwnProperty.call(setting, settingItem)) {
            const defaultVal = setting[settingItem];
            setting[settingItem] = GM_get(settingItem, defaultVal);
        }
    }
    var openedSettingPanel;
    //[函数]打开设置面板
    function openSettingPanel() {
        if (openedSettingPanel){
            closeSettingPanel();
        }
        var el = document.createElement("div");
        el.className = "omps-config";
        el.id = "omps-config";
        el.innerHTML = msgMaker.settingPanel();
        document.body.appendChild(el);
        openedSettingPanel=el;
    }
    function saveSettings() {
        var el = document.getElementById("omps-config");
        if (!el) return;
        GM_set("userId", document.getElementById("omps-input-name").value);
        GM_set("group", document.getElementById("omps-input-group").value);
        GM_set("autoJoin", document.getElementById("omps-input-quick").checked ? "1" : "");
        GM_set("silent", document.getElementById("omps-input-silent").checked ? "1" : "");
        setting.userId = document.getElementById("omps-input-name").value;
        setting.group = document.getElementById("omps-input-group").value;
        setting.autoJoin = document.getElementById("omps-input-quick").checked ? "1" : "";
        setting.silent = document.getElementById("omps-input-silent").checked ? "1" : "";
    }
    function closeSettingPanel() {
        var el = openedSettingPanel;
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }
    //===========设置相关============


    var msgMaker = {
        settingPanel: () => {//设置面板
            return `
            <label>${lang.setting.userId.label}</label>
            <small>${lang.setting.userId.tip}</small>
            <input class="omps-input i" id="omps-input-name" value="${setting.userId}">
            <br>
            <label>${lang.setting.group.label}</label>
            <small>${lang.setting.group.tip}</small>
            <input class="omps-input i" id="omps-input-group" value="${setting.group}">
            <br>
            <label>${lang.setting.autoJoin.label}</label>
            <small>${lang.setting.autoJoin.tip}</small>
            <input class="omps-input c" type="checkbox" id="omps-input-quick" ${setting.autoJoin ? "checked" : ""}>
            <br>
            <label>${lang.setting.silent.label}</label>
            <small>${lang.setting.silent.tip}</small>
            <input class="omps-input c" type="checkbox" id="omps-input-silent" ${setting.silent ? "checked" : ""}>
            <br><br>
            <a class="btn" onclick="ompsEventRouter('saveExit');return false;">${lang.setting.saveExit}</a>
            <a class="btn" onclick="ompsEventRouter('saveLink');return false;">${lang.setting.saveJoin}</a>
            `;
        },
        joinAsk: (hasConfigured) => {
            return `${lang.join}
                <a class="btn" onclick="ompsEventRouter('config');return false;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="black"class="bi bi-gear-fill" viewBox="0 0 16 16"><path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" /></svg>
                <span class="desc">${lang.reconfigure}</span>
            </a>
            <a class="btn"onclick="ompsEventRouter('create');return false;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="black" class="bi bi-arrow-right-circle-fill" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM4.5 7.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z"/></svg>
                <span class="desc">${lang.quickJoin}</span>
            </a>
            <a class="btn" onclick="ompsEventRouter('hide');return false;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="black" class="bi bi-x" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                <span class="desc">${lang.quit}</span>
            </a>
            `;
        },
        success: (code, delv) => {
            return `${lang.success}${delv}
                <a class="btn" onclick="ompsEventRouter('config');return false;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="black"class="bi bi-gear-fill" viewBox="0 0 16 16"><path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" /></svg>
                <span class="desc">${lang.reconfigure}</span>
            </a>
            <a class="btn" onclick="ompsEventRouter('hide');return false;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="black" class="bi bi-x" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                <span class="desc">${lang.quit}</span>
            </a>
            `;
        },
        conErr: () => {
            return `${lang.conErr}`;
        },
        pauseMsg: () => {
            return `${lang.pauseMsg}`;
        },
        playFail: () => {
            return `${lang.playFail}`;
        },
        delayTip: (delv) => {
            return `${lang.delay[0]}${delv}${lang.delay[1]}`;
        },
        syncSuccess: () => {
            return lang.syncSuccess;
        },
        playerJoin: (pname) => {
            return `${pname}${lang.playerJoin}`;
        },
        unsync: (target, deltaTime) => {
            return `${lang.unsync[0]}${target}${lang.unsync[1]}${deltaTime}${lang.unsync[2]}
            <a class=\"btn\" onclick=\"ompsEventRouter('sync');return false;\">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
            <span class="desc">${lang.sync}</span>
            </a>
            <a class=\"btn\" onclick=\"ompsEventRouter('call');return false;\">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-flag-fill" viewBox="0 0 16 16"><path d="M14.778.085A.5.5 0 0 1 15 .5V8a.5.5 0 0 1-.314.464L14.5 8l.186.464-.003.001-.006.003-.023.009a12.435 12.435 0 0 1-.397.15c-.264.095-.631.223-1.047.35-.816.252-1.879.523-2.71.523-.847 0-1.548-.28-2.158-.525l-.028-.01C7.68 8.71 7.14 8.5 6.5 8.5c-.7 0-1.638.23-2.437.477A19.626 19.626 0 0 0 3 9.342V15.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 1 0v.282c.226-.079.496-.17.79-.26C4.606.272 5.67 0 6.5 0c.84 0 1.524.277 2.121.519l.043.018C9.286.788 9.828 1 10.5 1c.7 0 1.638-.23 2.437-.477a19.587 19.587 0 0 0 1.349-.476l.019-.007.004-.002h.001"/></svg>
            <span class="desc">${lang.call}</span>
            </a>`
        },
        unsync_top: () => {
            return `${lang.unsync_top}
            <a class=\"btn\" onclick=\"ompsEventRouter('call');return false;\">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-flag-fill" viewBox="0 0 16 16"><path d="M14.778.085A.5.5 0 0 1 15 .5V8a.5.5 0 0 1-.314.464L14.5 8l.186.464-.003.001-.006.003-.023.009a12.435 12.435 0 0 1-.397.15c-.264.095-.631.223-1.047.35-.816.252-1.879.523-2.71.523-.847 0-1.548-.28-2.158-.525l-.028-.01C7.68 8.71 7.14 8.5 6.5 8.5c-.7 0-1.638.23-2.437.477A19.626 19.626 0 0 0 3 9.342V15.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 1 0v.282c.226-.079.496-.17.79-.26C4.606.272 5.67 0 6.5 0c.84 0 1.524.277 2.121.519l.043.018C9.286.788 9.828 1 10.5 1c.7 0 1.638-.23 2.437-.477a19.587 19.587 0 0 0 1.349-.476l.019-.007.004-.002h.001"/></svg>
            <span class="desc">${lang.call}</span>
            </a>`
        }
    }



    // 向服务器发送数据
    var sendDat = (data) => {
        ws.send(JSON.stringify(data));
    }

    //=============视频识别代码计算==============
    //检测VideoCode是否过期
    function detecVideoCode() {
        if (!initFinish) return;
        if (getVideoCode() != videoCode) {
            initFinish = false;
            showTip();
        } else setTimeout(detecVideoCode, 5000);
    }
    //计算当前视频对应的VideoCode（方案1：取视频所在的顶层页面标题，方案2：取视频所在页面的除query以外的URL）
    function getVideoCode() {
        var orgCode = "";
        try { orgCode = GM_window.top.document.title; } catch (e) { };
        if (!orgCode) {
            try { orgCode = GM_window.location.host + GM_window.location.pathname; } catch (e) { };
        }
        var tmpVideoCode = HASH.md5(orgCode);
        tmpVideoCode = tmpVideoCode.toUpperCase();
        return tmpVideoCode;
    }
    //更新VideoCode
    function calcVideoCode(video, callBack) {
        videoCode = getVideoCode();
        callBack();
    }
    //=============视频识别代码计算==============


    //==========TOAST提示条====================
    var toastElement;
    function showToast(text, time, imp) {
        if (time === undefined) time = -1;
        else time *= 5;

        if (time != -1 && setting.silent && !imp) return hideToast();

        if (!toastElement) {
            toastElement = document.createElement("div");
            toastElement.className = "omps-tip"
            video.parentNode.appendChild(toastElement);
        }

        toastCnt = time;
        toastElement.innerHTML = "<div>" + text + "</div>";
        toastElement.style.display = "block";
        setTimeout(() => {
            toastElement.classList.add("open");
        }, 100);
    }
    function hideToast(fh) {
        if (fh) {
            if (toastElement) toastElement.style.display = "none";
            toastCnt = 0;
        } else {
            if (toastElement) toastElement.classList.remove("open");
        }
    }
    //==========TOAST提示条====================


    //==========加入流程===========
    function showTip() {
        //STYLE_A 加入目标window，使得视频播放器中样式可用
        var el = document.createElement("style");
        el.innerHTML = css;
        el.className = "OMPS_CSS";
        video.parentNode.appendChild(el);
        //B 在大window中加入样式
        el = document.createElement("style");
        el.innerHTML = css;
        el.className = "OMPS_CSS";
        document.body.appendChild(el);

        if (setting.autoJoin && setting.userId && setting.group) {
            ompsEventRouter("create");
        } else
            showToast(msgMaker.joinAsk(), 20, 1);
    }
    var getVideosNextIframeList
    //获取视频
    function testVideo() {
        globalCount--;
        try {
            video = null
            var videos = document.getElementsByTagName("video");
            for (let i = 0; i < videos.length; i++) {
                var v = videos[i];
                if (!video && document.body.offsetWidth < v.offsetWidth * 3) {
                    video = v;
                    break;
                }
            }
            if (getVideosNextIframeList) {
                for (let i = 0; i < getVideosNextIframeList.length; i++) {
                    try {
                        var frameBody = getVideosNextIframeList[i].contentDocument.body;
                        if (frameBody.getAttribute("data-omps-injected") == "true") continue;
                        getVideosNextIframeList[i].contentWindow.ompsEventRouter = ompsEventRouter;
                        var videos = getVideosNextIframeList[i].contentDocument.getElementsByTagName("video");
                        for (let i = 0; i < videos.length; i++) {
                            var v = videos[i];
                            if (!video && frameBody.offsetWidth < v.offsetWidth * 3) {
                                video = v;
                                break;
                            }
                        }
                    } catch (e) { };
                }
            }
            getVideosNextIframeList = document.getElementsByTagName("iframe");
        } catch (e) {
            video = null;
        }
        if (video) {
            calcVideoCode(video, showTip);
        } else if (globalCount >= 0)
            setTimeout(testVideo, 5000);
    }
    //连接网络
    function initNetwork() {
        if (ws) {
            try { ws.onclose = ws.onerror = () => { }; } catch (e) { }
            try { ws.close(); } catch (e) { }
        }
        ws = new WebSocket(URL);
        ws.onmessage = wsMsg;
        ws.onopen = () => setTimeout(() => {
            sendDat({
                type: "reg",
                user: setting.userId,
                group: videoCode + "-" + setting.group
            });
        }, 1000);
        ws.onclose = ws.onerror = () => {
            showToast(msgMaker.conErr(), 5);
        }
    }
    //==========加入流程===========

    //=========前端暴露函数=============
    var ompsEventRouter = GM_window.ompsEventRouter = function (name) {
        if (name == "config") {
            openSettingPanel();
        } else if (name == "create") {
            hideToast();
            if (setting.group && setting.userId) initNetwork();
            else openSettingPanel();
        } else if (name == "call") {
            sendDat({
                type: "call",
                time: video.currentTime * 1000 + localDelay
            });
        } else if (name == "sync") {
            sendDat({
                type: "sync"
            });
        } else if (name == "hide") {
            hideToast();
        } else if (name == "saveExit") {
            saveSettings();
            closeSettingPanel();
        } else if (name == "saveLink") {
            saveSettings();
            if (setting.group && setting.userId) {
                hideToast();
                initNetwork();
                closeSettingPanel();
            }

        }
    }
    //=========前端暴露函数=============

    //200ms时钟，用于触发等待点和上报时间
    setInterval(() => {
        if (initFinish) {
            globalCount++;
            globalCount %= 40;
            if (globalCount == 0) {
                tmpLocalDelay = Date.now();
                sendDat({ type: "delay" });
            }
            if (toastCnt > 0) {
                if (--toastCnt == 0) {
                    hideToast();
                    setTimeout(() => {
                        if (toastCnt == 0) hideToast(1);
                    }, 1000);
                }
            }

            var currentTime = parseInt(video.currentTime * 1000);
            if (globalCount % 2 == 0 && currentTime != lastTime) {
                sendDat({
                    type: "ping",
                    time: currentTime + localDelay
                })
                lastTime = currentTime;
            }
            if (pauseAt != -1 && video.currentTime > pauseAt) {
                video.pause();
                showToast(msgMaker.pauseMsg());
                pauseAt = -1;
            }
        }
    }, 200);


    //WEBSOCKET事件响应
    var wsMsg = (e) => {
        var data = JSON.parse(e.data), time, realTime;
        console.log(data);
        if (data.time) {
            time = (data.time + localDelay) / 1000;
            realTime = (data.time) / 1000;
        }
        switch (data.type) {
            case "init":
                if (data.time != 0) {
                    initTime = data.time;
                } else initTime = 0;
                localDelay = 0;
                pauseAt = -1;
                tmpLocalDelay = Date.now();
                sendDat({ type: "delay" });
                try {
                    video.play();
                    hideToast();
                } catch (e) {
                    showToast(msgMaker.playFail());
                }
                break;
            case "delay":
                localDelay = parseInt((Date.now() - tmpLocalDelay) / 2);
                if (initTime != 0) {
                    video.currentTime = (initTime + 3 * localDelay) / 1000;
                    initTime = 0;
                }
                if (localDelay > 600) {
                    showToast(msgMaker.delayTip(localDelay), 2);
                }
                if (!initFinish) {
                    setTimeout(() => { initFinish = true; detecVideoCode(); showToast(msgMaker.success(videoCode, localDelay), 5, 1); }, 1000);
                }
                break;
            case "pause":
                //服务器发送Pause指令
                //      指令包含：
                //          切换时间戳
                if (video.currentTime >= time) {
                    video.pause();
                    showToast(msgMaker.pauseMsg());
                } else pauseAt = time;

                break;
            case "play":
                //服务器发送Play指令
                if (video.currentTime > time) video.currentTime = time;
                try {
                    video.play();
                    showToast(msgMaker.syncSuccess(), 1);
                } catch (e) {
                    showToast(msgMaker.playFail());
                }
                pauseAt = -1;
                break;
            case "join":
                showToast(msgMaker.playerJoin(data.user), 1);
                break;
            case "unsync":
                let deltaTime = (time - video.currentTime).toFixed(1);
                if (deltaTime >= 0) deltaTime = "+" + deltaTime;
                if (data.target != setting.userId)
                    showToast(msgMaker.unsync(data.target, deltaTime));
                else
                    showToast(msgMaker.unsync_top());
                pauseAt = -1;
                break;
            case "sync":
                video.currentTime = (realTime);
                if (data.wait) {
                    video.pause();
                }
                pauseAt = -1;
                showToast(msgMaker.syncSuccess(), 1);
            default:
                break;

        }
    }
    //MD5 JS
    !function (n) { "use strict"; function d(n, t) { var r = (65535 & n) + (65535 & t); return (n >> 16) + (t >> 16) + (r >> 16) << 16 | 65535 & r } function f(n, t, r, e, o, u) { return d((u = d(d(t, n), d(e, u))) << o | u >>> 32 - o, r) } function l(n, t, r, e, o, u, c) { return f(t & r | ~t & e, n, t, o, u, c) } function g(n, t, r, e, o, u, c) { return f(t & e | r & ~e, n, t, o, u, c) } function v(n, t, r, e, o, u, c) { return f(t ^ r ^ e, n, t, o, u, c) } function m(n, t, r, e, o, u, c) { return f(r ^ (t | ~e), n, t, o, u, c) } function c(n, t) { var r, e, o, u; n[t >> 5] |= 128 << t % 32, n[14 + (t + 64 >>> 9 << 4)] = t; for (var c = 1732584193, f = -271733879, i = -1732584194, a = 271733878, h = 0; h < n.length; h += 16)c = l(r = c, e = f, o = i, u = a, n[h], 7, -680876936), a = l(a, c, f, i, n[h + 1], 12, -389564586), i = l(i, a, c, f, n[h + 2], 17, 606105819), f = l(f, i, a, c, n[h + 3], 22, -1044525330), c = l(c, f, i, a, n[h + 4], 7, -176418897), a = l(a, c, f, i, n[h + 5], 12, 1200080426), i = l(i, a, c, f, n[h + 6], 17, -1473231341), f = l(f, i, a, c, n[h + 7], 22, -45705983), c = l(c, f, i, a, n[h + 8], 7, 1770035416), a = l(a, c, f, i, n[h + 9], 12, -1958414417), i = l(i, a, c, f, n[h + 10], 17, -42063), f = l(f, i, a, c, n[h + 11], 22, -1990404162), c = l(c, f, i, a, n[h + 12], 7, 1804603682), a = l(a, c, f, i, n[h + 13], 12, -40341101), i = l(i, a, c, f, n[h + 14], 17, -1502002290), c = g(c, f = l(f, i, a, c, n[h + 15], 22, 1236535329), i, a, n[h + 1], 5, -165796510), a = g(a, c, f, i, n[h + 6], 9, -1069501632), i = g(i, a, c, f, n[h + 11], 14, 643717713), f = g(f, i, a, c, n[h], 20, -373897302), c = g(c, f, i, a, n[h + 5], 5, -701558691), a = g(a, c, f, i, n[h + 10], 9, 38016083), i = g(i, a, c, f, n[h + 15], 14, -660478335), f = g(f, i, a, c, n[h + 4], 20, -405537848), c = g(c, f, i, a, n[h + 9], 5, 568446438), a = g(a, c, f, i, n[h + 14], 9, -1019803690), i = g(i, a, c, f, n[h + 3], 14, -187363961), f = g(f, i, a, c, n[h + 8], 20, 1163531501), c = g(c, f, i, a, n[h + 13], 5, -1444681467), a = g(a, c, f, i, n[h + 2], 9, -51403784), i = g(i, a, c, f, n[h + 7], 14, 1735328473), c = v(c, f = g(f, i, a, c, n[h + 12], 20, -1926607734), i, a, n[h + 5], 4, -378558), a = v(a, c, f, i, n[h + 8], 11, -2022574463), i = v(i, a, c, f, n[h + 11], 16, 1839030562), f = v(f, i, a, c, n[h + 14], 23, -35309556), c = v(c, f, i, a, n[h + 1], 4, -1530992060), a = v(a, c, f, i, n[h + 4], 11, 1272893353), i = v(i, a, c, f, n[h + 7], 16, -155497632), f = v(f, i, a, c, n[h + 10], 23, -1094730640), c = v(c, f, i, a, n[h + 13], 4, 681279174), a = v(a, c, f, i, n[h], 11, -358537222), i = v(i, a, c, f, n[h + 3], 16, -722521979), f = v(f, i, a, c, n[h + 6], 23, 76029189), c = v(c, f, i, a, n[h + 9], 4, -640364487), a = v(a, c, f, i, n[h + 12], 11, -421815835), i = v(i, a, c, f, n[h + 15], 16, 530742520), c = m(c, f = v(f, i, a, c, n[h + 2], 23, -995338651), i, a, n[h], 6, -198630844), a = m(a, c, f, i, n[h + 7], 10, 1126891415), i = m(i, a, c, f, n[h + 14], 15, -1416354905), f = m(f, i, a, c, n[h + 5], 21, -57434055), c = m(c, f, i, a, n[h + 12], 6, 1700485571), a = m(a, c, f, i, n[h + 3], 10, -1894986606), i = m(i, a, c, f, n[h + 10], 15, -1051523), f = m(f, i, a, c, n[h + 1], 21, -2054922799), c = m(c, f, i, a, n[h + 8], 6, 1873313359), a = m(a, c, f, i, n[h + 15], 10, -30611744), i = m(i, a, c, f, n[h + 6], 15, -1560198380), f = m(f, i, a, c, n[h + 13], 21, 1309151649), c = m(c, f, i, a, n[h + 4], 6, -145523070), a = m(a, c, f, i, n[h + 11], 10, -1120210379), i = m(i, a, c, f, n[h + 2], 15, 718787259), f = m(f, i, a, c, n[h + 9], 21, -343485551), c = d(c, r), f = d(f, e), i = d(i, o), a = d(a, u); return [c, f, i, a] } function i(n) { for (var t = "", r = 32 * n.length, e = 0; e < r; e += 8)t += String.fromCharCode(n[e >> 5] >>> e % 32 & 255); return t } function a(n) { var t = []; for (t[(n.length >> 2) - 1] = void 0, e = 0; e < t.length; e += 1)t[e] = 0; for (var r = 8 * n.length, e = 0; e < r; e += 8)t[e >> 5] |= (255 & n.charCodeAt(e / 8)) << e % 32; return t } function e(n) { for (var t, r = "0123456789abcdef", e = "", o = 0; o < n.length; o += 1)t = n.charCodeAt(o), e += r.charAt(t >>> 4 & 15) + r.charAt(15 & t); return e } function r(n) { return unescape(encodeURIComponent(n)) } function o(n) { return i(c(a(n = r(n)), 8 * n.length)) } function u(n, t) { return function (n, t) { var r, e = a(n), o = [], u = []; for (o[15] = u[15] = void 0, 16 < e.length && (e = c(e, 8 * n.length)), r = 0; r < 16; r += 1)o[r] = 909522486 ^ e[r], u[r] = 1549556828 ^ e[r]; return t = c(o.concat(a(t)), 512 + 8 * t.length), i(c(u.concat(t), 640)) }(r(n), r(t)) } function t(n, t, r) { return t ? r ? u(t, n) : e(u(t, n)) : r ? o(n) : e(o(n)) } "function" == typeof define && define.amd ? define(function () { return t }) : "object" == typeof module && module.exports ? module.exports = t : n.md5 = t }(HASH);
    testVideo();
})();