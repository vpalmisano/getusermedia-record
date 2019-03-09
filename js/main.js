/*
*  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

// This code is adapted from
// https://rawgit.com/Miguelao/demos/master/mediarecorder.html

'use strict';

/* globals MediaRecorder */

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

const audioInputSelect = document.querySelector('select#audioSource');
const videoSelect = document.querySelector('select#videoSource');
const selectors = [audioInputSelect, videoSelect];

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
}

navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);

//
const mediaSource = new MediaSource();
mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
let mediaRecorder;
let recordedBlobs;
let sourceBuffer;

const infoMsgElement = document.querySelector('span#infoMsg');
const errorMsgElement = document.querySelector('span#errorMsg');
const recordedVideo = document.querySelector('video#recorded');
const recordButton = document.querySelector('button#record');
recordButton.addEventListener('click', () => {
  stopPlay();
  if (recordButton.textContent === 'Start Recording') {
    startRecording();
  } else {
    stopRecording();
  }
});

const playButton = document.querySelector('button#play');
playButton.addEventListener('click', () => {
  if(recordedVideo.src.startsWith('blob:')){
    stopPlay();
  }
  else{
    startPlay();
  }
});

const downloadButton = document.querySelector('button#download');
downloadButton.addEventListener('click', () => {
  const blob = new Blob(recordedBlobs, {type: 'video/webm'});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
});

function handleSourceOpen(event) {
  console.log('MediaSource opened');
  sourceBuffer = mediaSource.addSourceBuffer('video/webm');
  console.log('Source buffer: ', sourceBuffer);
}

function handleDataAvailable(event) {
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
    infoMsgElement.innerHTML = `Recorded ${recordedBlobs.length} seconds`;
  }
}

function startPlay(){
  stopPlay();
  const superBuffer = new Blob(recordedBlobs, {type: 'video/webm'});
  recordedVideo.src = window.URL.createObjectURL(superBuffer);
  recordedVideo.controls = true;
  recordedVideo.play();
  playButton.innerHTML = 'Stop';
}

function stopPlay(){
  if(recordedVideo.src.startsWith('blob:')){
    recordedVideo.pause();
    window.URL.revokeObjectURL(recordedVideo.src);
    recordedVideo.src = null;
    recordedVideo.controls = false;
    playButton.innerHTML = 'Play';
  }
}

function startRecording() {
  recordedBlobs = [];

  const MIME_TYPES = [
    'video/webm;codecs=H264',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  const mimeType = MIME_TYPES.find((m) => {
    return MediaRecorder.isTypeSupported(m);
  }) || '';

  try {
    mediaRecorder = new MediaRecorder(window.stream, { mimeType });
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
    return;
  }

  console.log('Created MediaRecorder', mediaRecorder, 'with mimeType', mimeType);
  infoMsgElement.innerHTML = `Record started (${mimeType})`;
  recordButton.textContent = 'Stop Recording';
  playButton.disabled = true;
  downloadButton.disabled = true;
  mediaRecorder.onstop = (event) => {
    console.log('Recorder stopped: ', event);
  };
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(1000);
  console.log('MediaRecorder started', mediaRecorder);

  playButton.disabled = true;
  downloadButton.disabled = true;
}

function stopRecording() {
  if(mediaRecorder && mediaRecorder.state !== 'inactive'){
    mediaRecorder.stop();
    console.log('Recorded Blobs: ', recordedBlobs);
    infoMsgElement.innerHTML = `Record stopped (${recordedBlobs.length} seconds)`;
  }
  recordButton.textContent = 'Start Recording';
  if(recordedBlobs && recordedBlobs.length > 0){
    playButton.disabled = false;
    downloadButton.disabled = false;
  }
}

document.querySelector('button#start').addEventListener('click', async (e) => {
  const gumVideo = document.querySelector('video#gum');
  if(window.stream){
    stopRecording();
    recordButton.disabled = true;
    gumVideo.srcObject = null;
    window.stream.getTracks().forEach((track) => {
      track.stop();
    });
    window.stream = null;
    e.target.innerHTML = 'Start camera';
    infoMsgElement.innerHTML = '';
  }
  else{
    const audioSource = audioInputSelect.value;
    const videoSource = videoSelect.value;
    const width = document.querySelector('#width').value;
    const height = document.querySelector('#height').value;
    const hasEchoCancellation = document.querySelector('#echoCancellation').checked;
    const constraints = {
      audio: {
        deviceId: audioSource ? {exact: audioSource} : undefined,
        echoCancellation: {exact: hasEchoCancellation}
      },
      video: {
        deviceId: videoSource ? {exact: videoSource} : undefined,
        width,
        height,
      }
    };
    console.log('Using media constraints:', constraints);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      recordButton.disabled = false;
      console.log('getUserMedia() got stream:', stream);
      infoMsgElement.innerHTML = `Camera started`;
      e.target.innerHTML = 'Stop camera';
      window.stream = stream;

      gumVideo.srcObject = stream;
    } catch (e) {
      console.error('navigator.getUserMedia error:', e);
      errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
    }
  }
});
