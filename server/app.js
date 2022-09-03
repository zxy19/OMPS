const { WebSocketServer } = require('ws');
const { createServer } = require('https');
const { readFileSync } = require('fs');
const port = 8093;

//连接管理部分
//该部分控制Websocket的连接和消息事件，以及在关闭连接时释放资源
const server = createServer({
    cert: readFileSync(__dirname + '/fullchain.pem'),
    key: readFileSync(__dirname + '/privkey.pem')
}).listen(port);
wss = new WebSocketServer({ server });
var connectIds = {}, connectUser = {}, userConnect = {}, connectCount = 1, userLastGrpId = {};
wss.on('connection', function connection(ws) {
    let conId = connectCount++;
    if (connectCount > 100000000) connectCount = 1;

    connectIds[conId] = ws;
    console.log(`[CONNECT]用户已连接，分配ID#${conId}`);
    ws.on('message', (data) => { wsMsg(data, conId); });
    ws.on('close', () => connectClosed(conId));
});
function closeConnect(conId) {
    if (!connectIds[conId]) return;
    var ws = connectIds[conId];
    connectClosed(conId);
    ws.close();
}
function connectClosed(conId) {
    if (!connectIds[conId]) return;
    if (connectUser[conId]) {
        if (userTrusted[connectUser[conId]]) delete userTrusted[connectUser[conId]];
        if (userConnect[connectUser[conId]]) {
            delete userConnect[connectUser[conId]];
        }
        if (userGrp[connectUser[conId]]) {
            decMenberGrp(userGrp[connectUser[conId]], connectUser[conId]);
        }
        delete connectUser[conId];
    }
    delete connectIds[conId];

}
function commandUser(userId, data) {
    let conId = userConnect[userId];
    let ws = connectIds[conId];
    if (!ws) {
        console.log("[ERROR]正在使用一个不存在的连接");
        return;
    }
    ws.send(JSON.stringify(data));
}
//组管理部分
//本部分代码用于管理连接的用户分组，并将不同群组的进度信息进行处理并发送指令用于同步
var grpTable = {}, userGrp = {}, grpData = {}, userTrusted = {};
function commandGrp(grpId, data) {
    console.log("[GRP_CMD]" + data.type, data);
    if (!grpTable[grpId]) return;
    grpTable[grpId].forEach(user => {
        commandUser(user, data);
    });
}
var lstSec = 0, currentSec;
function dealInfoGrp(grpId) {
    var grpInfo = grpData[grpId];
    if (!grpInfo) return;
    console.log(`[DEBUG]${grpInfo.status},time:${grpInfo.maxTime}, ${grpInfo.minTime}`);
    //失去同步状态：(不会触发wait判断)
    currentSec = new Date().getSeconds();
    if ((grpInfo.status != "unsync" || (currentSec % 5 == 0 && currentSec != lstSec)) && grpInfo.maxTime - grpInfo.minTime > 3000) {
        lstSec = currentSec;
        grpData[grpId].status = "unsync";
        commandGrp(grpId, {
            type: "unsync",
            target: grpInfo.maxUser,
            time: grpInfo.maxTime
        });
    }
    //当前所有设备均在正常播放
    if (grpInfo.status == "normal") {
        //条件：高速度比低速度的设备的进度快了3秒及以上
        if (grpInfo.maxTime - grpInfo.minTime >= 1200) {
            commandGrp(grpId, {
                type: "pause",
                time: grpInfo.maxTime
            });
            grpData[grpId].status = "wait";
        }
    }
    //当前正在等待低进度设备
    else if (grpInfo.status == "wait" || grpInfo.status == "unsync") {
        //条件：高速度比低速度的设备的进度差距短于1秒
        if (grpInfo.maxTime - grpInfo.minTime <= 600) {
            commandGrp(grpId, {
                type: "play",
                time: grpInfo.maxTime
            });
            grpData[grpId].status = "normal";
        }
    }
}
function updateGrp(grpId, userId, timeStamp) {
    if (!grpData[grpId]) return;
    grpData[grpId].time[userId] = timeStamp;
    console.log(grpData[grpId].time);
    grpData[grpId].minTime = grpData[grpId].maxTime = timeStamp;
    grpData[grpId].maxUser = userId;
    for (const key in grpData[grpId].time) {
        if (Object.hasOwnProperty.call(grpData[grpId].time, key)) {
            const element = grpData[grpId].time[key];
            if (parseInt(grpData[grpId].maxTime) < parseInt(element)) {
                grpData[grpId].maxTime = element;
                grpData[grpId].maxUser = key;
            }
            if (parseInt(grpData[grpId].minTime) > parseInt(element)) {
                grpData[grpId].minTime = element;
            }
        }
    }

    dealInfoGrp(grpId);
}
function userGetGrp(userId) {
    return userGrp[userId];
}
function addMenberGrp(grpId, userId) {
    if (!grpTable[grpId]) grpTable[grpId] = [], grpData[grpId] = { time: {}, status: "normal" };
    userGrp[userId] = grpId;
    grpTable[grpId].push(userId);
    //新加入用户同步进度
    let grpTime = grpData[grpId].maxTime;
    if (!grpTime) grpTime = 0;

    commandUser(userId, { type: "init", time: grpTime });
    //广播加入通知
    commandGrp(grpId, { type: "join", user: userId });
}
function decMenberGrp(grpId, userId) {
    delete userGrp[userId];
    if (grpTable[grpId]) {
        //在组中删除成员
        var flg = false;
        for (var i = 0; i < grpTable[grpId].length; i++) {
            if (flg) grpTable[grpId][i - 1] = grpTable[grpId][i];
            else if (grpTable[grpId][i] == userId) flg = true;
        }
        if (flg) grpTable[grpId].pop();
        if (grpData[grpId] && grpData[grpId].time && grpData[grpId].time[userId]) delete grpData[grpId].time[userId];

        //当前组的全部成员离开，删除对象
        if (!grpTable[grpId].length) delete grpTable[grpId], delete grpData[grpId];
        else {
            //否则，重新计算时间
            commandGrp(grpId, { type: "leave", user: userId });
            grpData[grpId].maxUser = "";
            for (const key in grpData[grpId].time) {
                if (Object.hasOwnProperty.call(grpData[grpId].time, key)) {
                    const element = grpData[grpId].time[key];
                    if (!grpData[grpId].maxUser) {
                        grpData[grpId].minTime = grpData[grpId].maxTime = element;
                        grpData[grpId].maxUser = key;
                    }
                    if (parseInt(grpData[grpId].maxTime) < parseInt(element)) {
                        grpData[grpId].maxTime = element;
                        grpData[grpId].maxUser = key;
                    }
                    if (parseInt(grpData[grpId].minTime) > parseInt(element)) {
                        grpData[grpId].minTime = element;
                    }
                }
            }
            dealInfoGrp(grpId);
        }
    }
}
function wsMsg(data, conId) {
    try {
        var dat = JSON.parse(data.toString());
    } catch (e) { return; }
    var user = dat.user;

    if (!user) user = connectUser[conId];
    if (!user || !dat.type) return;

    switch (dat.type) {
        case "reg":
            if (userConnect[user]) {
                if (userTrusted[user] && userTrusted[user] == dat.trust) {
                    commandUser(user, { type: "error", msg: "E_SECOND_CONN" });
                    closeConnect(userConnect[user]);
                    console.log(`[REGIEST]用户“${user}”已移除(重名再次连接)`);
                } else {
                    if (connectIds[conId]) {
                        connectIds[conId].send(JSON.stringify({ type: "error", msg: "E_USERNAME_DUMPL" }));
                        connectIds[conId].close();
                    }
                    break;
                }
            }
            connectUser[conId] = user;
            userConnect[user] = conId;
            userTrusted[user] = dat.trust;

            if (userLastGrpId[user] && dat.title) {
                if (grpTable[userLastGrpId[user]]) {
                    commandGrp(userLastGrpId[user], { type: "userJmp", name: user, title: dat.title,url:dat.url});
                }
            }
            userLastGrpId[user] = dat.group;

            addMenberGrp(dat.group, user);
            console.log(`[REGIEST]用户#${conId}已注册,群组#${dat.group},名字：“${user}”`);
            break;
        case "sync":
            commandUser(user, {
                type: "sync",
                time: grpData[userGetGrp(user)].maxTime + 500
            });
            break;
        case "call":
            grpData[userGetGrp(user)].status = "wait";
            var toTime = dat.time || grpData[userGetGrp(user)].time[user];
            commandGrp(userGetGrp(user), {
                type: "sync",
                time: toTime,
                wait: true
            });
            break;
        case "ping":
            updateGrp(userGetGrp(user), user, dat.time);
            break;
        case "list":
            var grpId = userGetGrp(user), ret = [];
            if (grpTable[grpId] && grpData[grpId] && grpData[grpId].time) {
                grpTable[grpId].forEach(usr => {
                    ret.push({
                        name: usr,
                        time: grpData[grpId].time[usr]
                    })
                });
            }
            commandUser(user, {
                type: "list",
                list: ret
            });
            break;
        case "msg":
            commandGrp(userGetGrp(user), {
                type: "msg",
                time: dat.time,
                msg: dat.msg,
                name: user
            });
            break;
        case "delay":
            commandUser(user, { type: "delay" });
            break;
    }
}