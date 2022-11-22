"use strict";

var constraints = { video: true, audio: true };
var shareBtn = document.querySelector("button#shareScreen");
var downloadLink = document.querySelector("a#downloadLink");
var mediaRecorder;
var chunks = [];
var count = 0;
var soundMeter = null;
var micNumber = 0;
var isRecoding = false;
var isScreenShared = false;
var VolumnStatus = false; // 紀錄音量結果， false 太小聲，true 代表音量正常
var FrequencyStatus = false; // 紀錄頻率比對結果，false 不正常，true 正常
var indexDict = {};
var testStartBtn = document.querySelector("button#testStart");
var testRecordFunctionBtn = document.querySelector("button#testRecordFunction");
var composedStream = null;
var localStream = null;
var soundMeterTimes = 0; //計算 soundMeter在錄音過程中跑過幾次
var onDetectionStart = false; // 標示是否應該開始偵測音量
var averageTestVolumn = 0; //偵測到的平均音量
var isTestRecordingFunction = false; //是否是在測試錄音功能
var isPeriodicTest = false; //是否是週期性連續測試
var todayPeriodicTestTime = 1; // 標註是今天第幾次週期性連續測試
var testResultNumber = 0; //測試音量轉換為0~10 的數字
var isSpecificTone = false; // 是否用單音測試
var audio10 = document.getElementById('432_10');
var audio20 = document.getElementById('432_20');
var specific20 = document.getElementById('432_20');
var testResultText = document.getElementById("testResult");
var curStatus = document.getElementById("testStatus");
testStartBtn.disabled = true;
testRecordFunctionBtn.disabled = true;

function onShareScreen() {
  shareBtn.disabled = true;
  if (!navigator.mediaDevices.getDisplayMedia) {
    alert(
      "navigator.mediaDevices.getDisplayMedia not supported on your browser, use the latest version of Chrome"
    );
    console.log("recording: navigator.mediaDevices.getDisplayMedia not supported on your browser, use the latest version of Chrome");
  } else {
    if (window.MediaRecorder == undefined) {
      alert(
        "MediaRecorder not supported on your browser, use the latest version of Firefox or Chrome"
      );
      console.log("recording: MediaRecorder not supported on your browser, use the latest version of Firefox or Chrome");
    } else {
      navigator.mediaDevices.getDisplayMedia(constraints).then(function(screenStream) {
          //check for microphone
          screenStream.getVideoTracks()[0].onended = function () {
            if(isRecoding){
              onRecordStop();
            }
            curStatus.innerHTML = '';
            shareBtn.disabled = false;
            testStartBtn.disabled = true;
            testRecordFunctionBtn.disabled = true;
            isScreenShared = false;
            composedStream = null;
          };
          navigator.mediaDevices.enumerateDevices().then(function(devices) {
              micNumber = 0;
              devices.forEach(function(device) {
                if (device.kind == "audioinput") {
                  micNumber++;
                }
              });
              console.log("recording: Devices = " + devices);
              console.log("recording: micNumber = " + micNumber);
              if (micNumber == 0) {
                getStreamSuccess(screenStream);
                console.log("recording: micNumber = 0, no audio input");
                alert("沒有偵測到麥克風")
              } else {
                //navigator.mediaDevices.getUserMedia({audio: true}).then(function(micStream) {
                    //if system audio has been shared
                    if (screenStream.getAudioTracks().length > 0) {
                      var context = new AudioContext();
                      composedStream = new MediaStream();
                      console.log("recording: composedStream has been created");
                      var audioDestination = context.createMediaStreamDestination();

                      const systemSource = context.createMediaStreamSource(screenStream);
                      const systemGain = context.createGain();
                      systemGain.gain.value = 1.0;
                      systemSource.connect(systemGain).connect(audioDestination);
                      console.log("recording: added system audio");
                      /*if (micStream && micStream.getAudioTracks().length > 0) {
                        const micSource = context.createMediaStreamSource(micStream);
                        const micGain = context.createGain();
                        micGain.gain.value = 1.0;
                        micSource.connect(micGain).connect(audioDestination);
                        console.log("recording: added mic audio");
                      }*/

                      audioDestination.stream.getAudioTracks().forEach(function(audioTrack) {
                          composedStream.addTrack(audioTrack);
                          testStartBtn.disabled = false;
                          testRecordFunctionBtn.disabled = false;
                          isScreenShared = true;
                          console.log("recording: system and mic audio has been added to composedStream");
                        });
                    } else {
                      alert("沒有收到系統聲音，請重新整理網頁後，再開啟錄音功能");
                      console.log("recording: no system audio has been added, add just the mic audio");
                    }
                  /*})
                  .catch(function(err) {
                    alert("沒有收到麥克風聲音，請重新整理網頁後，再開啟錄音功能");
                    log("recording: navigator.getUserMedia error: " + err);
                  });*/
              }
            })
            .catch(function(err) {
              alert("錄音功能未能成功開啟，請重新整理網頁後，再開啟錄音功能");
              console.log("recording: " + err.name + ": " + err.message);
            });
        })
        .catch(function(err) {
          alert("錄音功能未能成功開啟，請重新整理網頁後，再開啟錄音功能");
          console.log("recording: navigator.getDisplayMedia error: " + err);
        });
        console.log("recording: audio has been shared");
    }
  }
}

function getStreamSuccess(localStream) {
  
  localStream.getTracks().forEach(function(track) {
    if (track.kind == "audio") {
      track.onended = function(event) {
        console.log("recording: audio track.onended Audio track.readyState=" + track.readyState + ", track.muted=" + track.muted);
      };
    }
    if (track.kind == "video") {
      track.onended = function(event) {
        console.log("recording: video track.onended Audio track.readyState=" + track.readyState + ", track.muted=" + track.muted);
      };
    }
  });

  try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    window.audioContext = new AudioContext();
  } catch (e) {
    log("recording: Web Audio API not supported.");
  }

  soundMeter = window.soundMeter = new SoundMeter(window.audioContext);
  soundMeter.connectToSource(localStream, function(e) {
    if (e) {
      console.log(e);
      return;
    }
  });
}

function onRecordStart(helper_id) {
  localStream  = composedStream;
  getStreamSuccess(localStream);
  soundMeterTimes = 0;
  averageTestVolumn = 0;
  if (localStream == null) {
    alert("recording: Could not get localStream stream from mic/camera");
  } else {
    VolumnStatus = false;
    FrequencyStatus = false;
    indexDict = {};
    isRecoding = true;
    /* use the stream */
    console.log("recording: Start recording " + helper_id);
    if (typeof MediaRecorder.isTypeSupported == "function") {
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        var options = { mimeType: "video/webm;codecs=vp9" };
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=h264")) {
        var options = { mimeType: "video/webm;codecs=h264" };
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
        var options = { mimeType: "video/webm;codecs=vp8" };
      }
      console.log("recording: Using " + options.mimeType);
      mediaRecorder = new MediaRecorder(localStream, options);
    } else {
      console.log("recording: isTypeSupported is not supported, using default codecs for browser");
      mediaRecorder = new MediaRecorder(localStream);
    }

    mediaRecorder.ondataavailable = function(e) {
      chunks.push(e.data);
    };

    mediaRecorder.onerror = function(e) {
      console.log("recording: mediaRecorder.onerror: " + e);
    };

    mediaRecorder.onstart = function() {
      console.log("recording: mediaRecorder.onstart, mediaRecorder.state = " + mediaRecorder.state);
      if(isTestRecordingFunction){
          audio10.play();
      }else{
        setTimeout(function() {
          if(isRecoding){
            if(isSpecificTone){
              specific20.play();
            }else{
              audio20.play();
            }
          }
        }, 5000);
      }

      localStream.getTracks().forEach(function(track) {
        if (track.kind == "audio") {
          console.log("recording: onstart - Audio track.readyState=" + track.readyState + ", track.muted=" + track.muted);
        }
        if (track.kind == "video") {
          console.log("recording: onstart - Video track.readyState=" + track.readyState + ", track.muted=" + track.muted);
        }
      });
    };

    mediaRecorder.onstop = function() {
      console.log("recording: mediaRecorder.onstop, mediaRecorder.state = " + mediaRecorder.state);


      var blob = new Blob(chunks, { type: "video/webm" });
      chunks = [];

      var videoURL = window.URL.createObjectURL(blob);

      var nextdownloadLink  = document.createElement("a");



      nextdownloadLink.href = videoURL;
      nextdownloadLink.innerHTML =  "Download helper " + helper_id.toString() + " 、   ";
      if(helper_id){
        var name = helper_id+".webm";
      }else{
        var rand = Math.floor(Math.random() * 10000000);
        var name = "video_" + rand + ".webm";
      }
      nextdownloadLink.setAttribute("download", name);
      nextdownloadLink.setAttribute("name", name);
      document.getElementById("downloadLink").appendChild(nextdownloadLink);
      console.log("recording: "+name +" ready to be downloaded");
    };

    mediaRecorder.onwarning = function(e) {
      console.log("recording: mediaRecorder.onwarning: " + e);
    };

    mediaRecorder.start(10);

    localStream.getTracks().forEach(function(track) {
      log(track.kind + ":" + JSON.stringify(track.getSettings()));
      console.log(track.getSettings());
    });
  }
}

function onRecordStop() {
  isRecoding = false;
  mediaRecorder.stop();
  console.log("recording: Stop recording, soundMeterTimes = " + soundMeterTimes);
  soundMeter.stop();
  localStream  = null;
  if(isTestRecordingFunction){
    audio10.pause();
    audio10.currentTime = 0;
  }else{
    if(isSpecificTone){
      specific20.pause();
      specific20.currentTime = 0;
    }else{
      audio20.pause();
      audio20.currentTime = 0;
    }
  }
  compareSound();
  addTestResult();
  console.log(indexDict);
}

function compareSound(){
  if(isTestRecordingFunction){
    averageTestVolumn = averageTestVolumn/(soundMeterTimes);
  }else{
    averageTestVolumn = averageTestVolumn/(soundMeterTimes-879);
  }
  console.log("recording: averageTestVolumn=" +averageTestVolumn);
  testResultNumber = 0;
  indexDict[12] = (indexDict[12] === undefined) ? 0 : indexDict[12];
  indexDict[13] = (indexDict[13] === undefined) ? 0 : indexDict[13];
  indexDict[22] = (indexDict[22] === undefined) ? 0 : indexDict[22];
  indexDict[23] = (indexDict[23] === undefined) ? 0 : indexDict[23];
  indexDict[36] = (indexDict[36] === undefined) ? 0 : indexDict[36];
  indexDict[37] = (indexDict[37] === undefined) ? 0 : indexDict[37];
  var countTestIndex = indexDict[12] + indexDict[13] + indexDict[22] + indexDict[23];
  var countHelperIndex = indexDict[22] + indexDict[23];
  var indexDictLen =  Object.keys(indexDict).length;
  console.log("recording: countTestIndex = " + countTestIndex)
  console.log("recording: countHelperIndex = " + countHelperIndex)
  console.log("recording: indexDict length = " + indexDictLen)
  let maxKey, maxValue = 0;

  for(const [key, value] of Object.entries(indexDict)) {
    if(value > maxValue) {
      maxValue = value;
      maxKey = key;
    }
  }
  console.log(maxKey);
  if(isTestRecordingFunction){
    if(averageTestVolumn >=0.0009){
      VolumnStatus = true;
    }
    if(maxKey == 36 || maxKey == 37 || maxKey == 38 || maxKey == 39){
        FrequencyStatus = true
    }
  }else{
    if(isSpecificTone){
      if(maxKey == 36 || maxKey == 37 || maxKey == 38 || maxKey == 39){
        FrequencyStatus = true
      }
      if(averageTestVolumn>0.1){
        testResultNumber = 10;
        VolumnStatus = true;
      }else if(averageTestVolumn < 0.002){
        testResultNumber = Math.round(((averageTestVolumn -0)/ 0.002)*5);
      }else if(averageTestVolumn >=0.002){
        VolumnStatus = true;
        testResultNumber = Math.round(((averageTestVolumn -  0.002)/0.098)*5)+5;
      } 
    }else{
      if(countHelperIndex >=25 && indexDictLen <= 60){
        FrequencyStatus = true
      }
      if(averageTestVolumn>0.1){
        testResultNumber = 10;
        VolumnStatus = true;
      }else if(averageTestVolumn < 0.01){
        testResultNumber = Math.round(((averageTestVolumn -0)/ 0.01)*5);
      }else if(averageTestVolumn >=0.01){
        VolumnStatus = true;
        testResultNumber = Math.round(((averageTestVolumn -  0.01)/0.09)*5)+5;
      }
    }
  }
  if(isTestRecordingFunction){
    if(VolumnStatus && FrequencyStatus){
      testResultText= "錄音功能正常";
    }else if(!VolumnStatus && FrequencyStatus){
      testResultText= "錄下正常的聲音，但是電腦音量太小，調高電腦喇叭音量到25，並且重新整理系統維護網頁(按ctrl + F5)";
    }else if(VolumnStatus && !FrequencyStatus){
      testResultText= "錄下電腦的音量是正常的，但是錄下的聲音不是正常的聲音，確認電腦正在沒有撥放其他聲音，重新整理系統維護網頁(按ctrl + F5)";
    }else{
      testResultText= "錄下電腦的音量太小了，並且錄下的聲音不是正常的聲音，調高電腦喇叭音量到25，確認電腦正在沒有撥放其他聲音，重新整理系統維護網頁(按ctrl + F5)";
    }
  }else{
      if(VolumnStatus && FrequencyStatus){
        testResultText= "有聲音，且正常回傳聲音, 平均音量: " + testResultNumber;
      }else if(VolumnStatus && !FrequencyStatus){
        testResultText= "有聲音，但是回傳的不是測試用的的聲音, 平均音量: " + testResultNumber;
      }else if(!VolumnStatus && FrequencyStatus){
        testResultText= "有回傳測試用的聲音，但是聲音音量太小或是幾乎沒聲音, 平均音量: " + testResultNumber;
      }else{
        testResultText= "音量太小或是沒聲音，且沒有回傳測試用的聲音, 平均音量: " + testResultNumber;
      }
  }
}

function addTestResult(){
  var curResult = document.createElement("strong");
  curResult.innerHTML = "<br>"+ testResultText;
  document.getElementById("testResult").appendChild(curResult);
  if(isPeriodicTest){
    var curResult = document.createElement("strong");
    curResult.innerHTML = "<br>"+ testResultText;
    document.getElementById("latestTestResult").appendChild(curResult);
  }
}

function ontestRecordFunction(){
  isTestRecordingFunction = true;
  onRecordStart("錄音功能測試結果");
  testRecordFunctionBtn.disabled = true;
  testStartBtn.disabled = true;
  setTimeout(()=>{
    onRecordStop();
    isTestRecordingFunction = false;
    curStatus.innerHTML =  "已完成錄音測試，如功能正常，請稍候15秒即可開始連續自動測試";
    setTimeout(() =>{
      testRecordFunctionBtn.disabled = false;
      testStartBtn.disabled = false;
      curStatus.innerHTML =  "已完成錄音測試，如功能正常，可開始連續自動測試";
      console.log("test finish")
    }, 15000);
  }, 10000);
}

function log(message) {
  console.log(message);
}

function onTestStart(clear = true){
    onRecordStart("測試結果");
    if(clear){
        testResultText.innerHTML = '';
        curStatus.innerHTML = '';
    }
    downloadLink.innerHTML = '';
    document.getElementById("latestTestResult").innerHTML = "";
    var now = new Date();
    var curLatestTitle = document.createElement("strong");
    curLatestTitle.innerHTML = "<br>在" + now.getDate()+ "日"  +now.getHours()+" 點"+ now.getMinutes() + " 分開始的測試結果如下:";
    document.getElementById("latestTestResult").appendChild(curLatestTitle);
    onDetectionStart = false;
    curStatus.innerHTML =  "正在測試";
    console.log("recording: Testing");
    testStartBtn.disabled = true;
    testRecordFunctionBtn.disabled = true;
    setTimeout(()=>{
        onRecordStop();
        curStatus.innerHTML =  "測試結束";
        console.log("test finish")
        console.log("recording: testTimer setInterval cleared")
        testStartBtn.disabled = false
        testRecordFunctionBtn.disabled = false
    },45*1000);
}



  

// Meter class that generates a number correlated to audio volume.
// The meter class itself displays nothing, but it makes the
// instantaneous and time-decaying volumes available for inspection.
// It also reports on the fraction of samples that were at or near
// the top of the measurement range.
function SoundMeter(context) {
  this.context = context;
  this.instant = 0.0;
  this.slow = 0.0;
  this.clip = 0.0;
  this.script = context.createScriptProcessor(2048, 1, 1);
  var that = this;
  this.script.onaudioprocess = function(event) {
    const input = event.inputBuffer.getChannelData(0);
    //const FFT = require('fft.js');
    const f = new FFTJS(2048);
    const out = f.createComplexArray();
    f.realTransform(out, input);
    const out_abs =  out.map(Math.abs);
    //console.log(out_abs);
    const max = Math.max(...out_abs);
    const index = out_abs.indexOf(max);
    var i;
    var sum = 0.0;
    var clipcount = 0;
    for (i = 0; i < input.length; ++i) {
      sum += input[i] * input[i];
      if (Math.abs(input[i]) > 0.99) {
        clipcount += 1;
      }
    }
    that.instant = Math.sqrt(sum / input.length);
    that.slow = 0.95 * that.slow + 0.05 * that.instant;
    that.clip = clipcount / input.length;
    //console.log("recording: input.length = " + input.length);
    //console.log("recording: Audio activity: " + Math.round(soundMeter.instant.toFixed(2) * 100) +  " instant = " + that.instant);
    soundMeterTimes  += 1;
    if(isTestRecordingFunction){
      if(soundMeterTimes == 1){
        console.log("recording: 0seconds , start sound detection!");
        onDetectionStart = true;
      }
      averageTestVolumn += that.instant;
      //console.log("recording:  instant " + that.instant);
      //console.log("recording:  soundMeterTimes " + soundMeterTimes);
      if(index in indexDict){
        indexDict[index] = indexDict[index] + 1;
      }else{
        indexDict[index] = 1;
      }
      //console.log(out);
    }else{
      if(soundMeterTimes >=879){
        if(soundMeterTimes == 879){
          console.log("recording: 37seconds , start sound detection!");
          onDetectionStart = true;
        }
        averageTestVolumn += that.instant;
        //console.log("recording:  instant " + that.instant);
        //console.log("recording:  soundMeterTimes " + soundMeterTimes);
        if(index in indexDict){
          indexDict[index] = indexDict[index] + 1;
        }else{
          indexDict[index] = 1;
        }
        //console.log(out);
      }
    }
  }
}

SoundMeter.prototype.connectToSource = function(stream, callback) {
  console.log("recording: SoundMeter connecting");
  try {
    this.mic = this.context.createMediaStreamSource(stream);
    this.mic.connect(this.script);
    // necessary to make sample run, but should not be.
    this.script.connect(this.context.destination);
    if (typeof callback !== "undefined") {
      callback(null);
      console.log("recording: SoundMeter connected successfully");
    }
  } catch (e) {
    console.error(e);
    if (typeof callback !== "undefined") {
      callback(e);
      console.log("recording: SoundMeter fail to connect");
    }
  }
};
SoundMeter.prototype.stop = function() {
  this.mic.disconnect();
  this.script.disconnect();
  console.log("recording: SoundMeter disconnect");
};
