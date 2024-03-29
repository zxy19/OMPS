# OMPS在线多人播放器同步脚本

> 想和朋友一起看剧/看番，但是缺少一个平台？
> 
> 直播担心版权问题，远程桌面的卡顿也难以接受？

部署OMPS，只需一个浏览器脚本，即可同步所有人的播放进度。

[以下为部署指南，用户指南请点这里](https://xypp.cc/omps)

## 功能/特性
+ 加入时进度同步
+ 播放过程中进度同步
+ 快进/退后可以调整所有人的进度或跳转到最快的进度
+ 打开页面自动加入房间
+ 根据不同的页面匹配不同的用户
+ 跳转时对原先放映厅的人发出提示
+ 支持视频内文字聊天
+ 跳转到任何人的位置

## 支持性
+ TamperMonkey
    + 已测试支持Chrome，Edge，360极速（chromium）等等主流浏览器
    + 无IE支持计划
+ 直接运行脚本方式
    + 已测试移动端下列浏览器
        + 安卓Via（手机，平板）
    + 理论上任何支持脚本的浏览器均支持
> **经测试，IOS SAFARI内核下，VIA浏览器会出现无法更改进度的bug**

## 自行部署方式
1. 选择一台拥有公网地址的服务器，运行server/app.js
    + 更改端口号的方法：Line.4，更改port常量
    + **需要为服务端配置证书。原代码例子采用宝塔LEv2证书。可直接将同域名的证书中的privkey.pem和fullchain.pem下载后放置于app.js同目录下**
2. 所有需要同步的客户端安装脚本
    + **您需要在脚本开头将URL替换成您的服务器地址**
    + TamperMonkey可直接导入脚本
    + 移动端请打开JS文件，全选复制后至浏览器的脚本选项中添加
3. 打开同一个视频页面，在弹出的提示条中选择 加入(→) 按钮

## QA

> 打开视频后没有出现提示条

检查脚本是否正确安装。此外，如果视频宽小于1/3屏幕宽不会触发该功能

> 与服务器连接断开

参考控制台输出，检查服务器配置是否正确 

> 视频总是卡

a)检查是否真的有人卡了

b)刷新页面重试

> 其他

由于测试人员严重不足，可能存在未发现的bug，可以在项目中提ISSUE