const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

const calibBtn = `    <!-- GeoGame Calibration Button -->
    <button id="btn-geogame-calibrate" class="absolute bottom-4 right-4 bg-gray-800 text-gray-400 p-2 rounded hover:text-white" title="Calibrate Locations">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>`;

if (!html.includes('id="btn-geogame-calibrate"')) {
    html = html.replace('<!-- INTRO SCREEN -->', calibBtn + '\n\n    <!-- INTRO SCREEN -->');
}

const calibScreen = `    <!-- CALIBRATION SCREEN -->
    <div id="geogame-calibration-screen" class="geogame-screen hidden bg-gray-900 text-white flex">
      <!-- Sidebar -->
      <div class="w-80 h-full bg-gray-800 flex flex-col border-r border-gray-700">
        <div class="p-4 border-b border-gray-700 flex justify-between items-center">
           <h2 class="text-xl font-bold">Calibration</h2>
           <button id="btn-geogame-exit-calib" class="text-red-400 hover:text-red-300 font-bold">Exit</button>
        </div>
        <div class="p-2 text-xs text-gray-400 bg-gray-900">
          <b>Left click list</b>: Zoom to location<br>
          <b>Right click map</b>: Set new coordinates<br>
          <b>Left click map</b>: Confirm & Next
        </div>
        <div id="geogame-calib-list" class="flex-1 overflow-y-auto p-2 space-y-1">
           <!-- Populated via JS -->
        </div>
      </div>
      <!-- Map Area -->
      <div id="geogame-calib-map-container" class="flex-1 h-full relative bg-gray-900 overflow-hidden cursor-crosshair">
         <div id="geogame-calib-status" class="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 px-4 py-2 rounded text-lg font-bold z-10 hidden"></div>
      </div>
    </div>`;

if (!html.includes('id="geogame-calibration-screen"')) {
    html = html.replace('<!-- COUNTDOWN SCREEN -->', calibScreen + '\n\n    <!-- COUNTDOWN SCREEN -->');
}

fs.writeFileSync('frontend/index.html', html);
console.log('Updated index.html');
