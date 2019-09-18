
let layout = undefined;
let dataCache = {};
let currentIndex = 0;
let jsonMetaData = [];
let dataSource = "";
let htmlCache = {};
let svgKeys = [];
let indexAutoAdvanceStep = 1;
let step1Limit = 23;
let indexAutoAdvanceStep2 = 5;
let datasetName = 'mnist_medium';
let autoStep = false;
let dataPrefix = '';
let sliderEventListener = undefined;

function randomIntFromInterval(min, max) { // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function paramStrToAssocArray(prmstr) {
  let params = {};
  let prmarr = prmstr.split('&');
  for (let i = 0; i < prmarr.length; i++) {
    let tmparr = prmarr[i].split('=');
    params[tmparr[0]] = tmparr[1];
  }
  return params;
}

function parseGet() {
  let paramStr = window.location.search.substr(1);
  return paramStr !== null && paramStr !== ''
    ? paramStrToAssocArray(paramStr)
    : {};
}


function parseId(id) {
  let idParts = id.split("_");
  let blockIndex = parseInt(idParts[1]);
  let layerIndex = parseInt(idParts[3]);
  let neuronIndex = parseInt(idParts[5]);
  return {blockIndex, layerIndex, neuronIndex}
}

function getMaxNeurons(network, blockIndex, layersIndices) {
  let layerSet = new Set(layersIndices);
  let values = Object.keys(network.blocks[blockIndex].layers)
    .filter(layerIndex => layerSet.has(layerIndex))
    .map(function(layerIndex){
      return network.blocks[blockIndex].layers[layerIndex];
    });
  return values.reduce((tot, {size}) => Math.max(tot, size), 0);
}


function genNeuronPositionsForBlock(network, blockIndex, totalLayers, width, height, startX, xRandomRange, borderX, borderY, layerOffset) {
  let stepX = (width - (borderX * 2)) / totalLayers;
  let stepY = (height - (borderY *2)) / network.maxNeurons;
  let block = network.blocks[blockIndex];

console.log("border x ", borderX, " bordery ", borderY)
  return [...Array(block.size).keys()].map((layerIndex) => {
    let layer = block.layers[layerIndex];
    let totalNeurons = layer.size;
    let startY = (height / 2.0) - (totalNeurons / 2) * stepY;
    return [...Array(layer.size).keys()].map((neuronIndex) => {
      // To constraint last layer to have same x position
      // layerIndex < (block.size-1)
      let offset = layerIndex > 0  ? randomIntFromInterval(-xRandomRange, xRandomRange) : 0 ;
      let xPos = startX + stepX * (layerIndex+ layerOffset) + offset;
      return {x: Math.min(xPos, width - borderX), y: Math.min(height-borderY, Math.max(borderY, startY + stepY * neuronIndex)), degree: 1}
    });
  })
}

function genNeuronPositions(network, networkFilter, width, height, startX) {
  let totalLayers = 0;
  let filterBlockIndices = Object.keys(toRenderNetwork.blocks);
  let maxNeurons = 0;
  filterBlockIndices.forEach(blockIndex => {
    let block = toRenderNetwork.blocks[blockIndex];
    if (block.layers === "all") {
      totalLayers += network.blocks[blockIndex].layers.size;
      maxNeurons = Math.max(maxNeurons, getMaxNeurons(network, blockIndex, network.blocks[blockIndex].layers.size))
    }
    else {
      totalLayers += block.layers.length;
      maxNeurons = Math.max(maxNeurons, getMaxNeurons(network, blockIndex, block.layers))
    }
  });

  let stepX = (width - borderX * 2) / totalLayers;
  let stepY = height / maxNeurons;

  filterBlockIndices.map(blockIndex => {
    let block = network.blocks[blockIndex];

    return [...Array(block.size).keys()].map((layerIndex) => {
      let layer = block.layers[layerIndex];
      let totalNeurons = layer.size;
      let startY = (height / 2.0) - (totalNeurons / 2) * stepY;
      return [...Array(layer.size).keys()].map((neuronIndex) => {
        let xPos = startX + stepX * (layerIndex+ layerOffset) + randomIntFromInterval(-10, 10);
        return {x: Math.min(xPos, width -5), y: startY + stepY * neuronIndex, degree: 1}
      });
    })});

}

function generateLinkData(data, nodes, networkFilter = null) {
  // let edges = data.edges;
  // if (networkFilter !== null) {
  //   edges = edges.filter(({source: src, target: dest}) => {
  //     return
  //   });
  // }

  return data.edges.filter(({source: src, target: dest}) => {
    let srcData = parseId(src);
    let destData = parseId(dest);

    // return renderBlocks.has(srcData.blockIndex)
    //   && renderBlocks.has(destData.blockIndex);
    // srcData.blockIndex === blockIndex && destData.blockIndex === blockIndex
    let k = srcData.blockIndex === destData.blockIndex && srcData.layerIndex === destData.layerIndex;


    return true;
    // (srcData.blockIndex === blockIndex && destData.blockIndex === blockIndex)
    // || (srcData.blockIndex === blockIndex && destData.blockIndex === blockIndex2)); //&& destData.layerIndex === 0)

  }).map(({source: src, target: dest, weight}) => {
    let srcData = parseId(src);
    let destData = parseId(dest);
    // if (destData.blockIndex === blockIndex2) {
    //   destData.layerIndex = network.blocks[srcData.blockIndex].size + destData.layerIndex
    // }

    return {
      source: nodes[srcData.layerIndex][srcData.neuronIndex],
      target: nodes[destData.layerIndex][destData.neuronIndex],
      weight: parseFloat(weight)

    }
  });
}

function generateLinks(nodes, dataLinks, width, height) {
  let bundle = {nodes: [], links: [], paths: []};
  let distance = function (source, target) {
    // sqrt( (x2 - x1)^2 + (y2 - y1)^2 )
    let dx2 = Math.pow(target.x - source.x, 2);
    let dy2 = Math.pow(target.y - source.y, 2);

    return Math.sqrt(dx2 + dy2);
  };

  // max distance any two nodes can be apart is the hypotenuse!
  let hypotenuse = Math.sqrt(width * width + height * height);

  // number of inner nodes depends on how far nodes are apart
  let inner = d3.scaleLinear()
    .domain([0, hypotenuse])
    .range([1, 15]);

  bundle.nodes = nodes.map(function (d, i) {
    d.fx = d.x;
    d.fy = d.y;
    return d;
  });


  dataLinks.forEach(function (d, i) {
    // calculate the distance between the source and target
    let length = distance(d.source, d.target);

    // calculate total number of inner nodes for this link
    let total = Math.round(inner(length));

    // create scales from source to target
    let xscale = d3.scaleLinear()
      .domain([0, total + 1]) // source, inner nodes, target
      .range([d.source.x, d.target.x]);

    let yscale = d3.scaleLinear()
      .domain([0, total + 1])
      .range([d.source.y, d.target.y]);

    // initialize source node
    let source = d.source;
    let target = null;

    // add all points to local path
    let sT = {
      ...source,
      weight: d.weight
    };
    let local = [sT];

    for (let j = 1; j <= total; j++) {
      // calculate target node
      target = {
        x: xscale(j),
        y: yscale(j)
      };

      local.push(target);
      bundle.nodes.push(target);

      bundle.links.push({
        source: source,
        target: target
      });

      source = target;
    }

    local.push(d.target);

    // add last link to target node
    bundle.links.push({
      source: target,
      target: d.target
    });

    bundle.paths.push(local);
  });
  return bundle;
}


function buildNetworkStructure(nodes) {
  let network = {blocks: { }};

  let globalMaxNeurons = 0;

  nodes.forEach(node => {
    let idParts = node.split("_");
    let blockIndex = parseInt(idParts[1]);
    let layerIndex = parseInt(idParts[3]);
    let neuronIndex = parseInt( idParts[5]) ;


    let block = network.blocks[blockIndex];
    if (block === undefined) {
      network.blocks[blockIndex] = {layers: {}}
    }
    let layer = network.blocks[blockIndex].layers[layerIndex];
    if (layer === undefined) {
      network.blocks[blockIndex].layers[layerIndex] = {size: 0};
    }

    layer  = network.blocks[blockIndex].layers[layerIndex];
    let neurons = Math.max(layer.size, neuronIndex + 1);
    globalMaxNeurons = Math.max(globalMaxNeurons, neurons);
    network.blocks[blockIndex].layers[layerIndex].size = neurons;
    // blocks[block] = blocks[block] !== undefined ? blocks[block]+ 1 : 0;

  });

  Object.keys(network.blocks).forEach(key => {
    network.blocks[key].size = Object.keys(network.blocks[key].layers).length
  });
  network.blocks.size = Object.keys(network.blocks).length;
  network.maxNeurons = globalMaxNeurons;
  return network;
}

function getSvgDimensions(svgId) {
  let svgEl = document.getElementById(svgId);
  let rect = svgEl.getBoundingClientRect();
  return rect;
}

function buildNetwork(data, blockIndex = 0) {
  let structure = buildNetworkStructure(data.nodes);

  let svg = d3.select('#d3-svg');
  //
  // let svgEl = document.getElementById('d3-svg');
  //
  // let bb = svgEl.getBBox();
  //
  // var rect = svgEl.getBoundingClientRect();
  //
  // // let width = +svg.attr("width");
  // // let height = +svg.attr("height");
  //
  // let width = +rect.width;
  // let height = +rect.height;

  let {
    width,
    height
  } = getSvgDimensions('d3-svg');

  // console.log("Width ", width, " height ", height, " border ", 100/width, " border y ", 20/height);

  let startX = width * 0.05;
  let borderX = width * 0.02;
  let borderY = height * 0.06527;
  let randomRangeX = width * 0.1612;

  let neuronPositions = genNeuronPositionsForBlock(
    structure,
    blockIndex,
    structure.blocks[blockIndex].size,
    width,
    height,
    startX,
    randomRangeX,
    borderX,
    borderY,
    0
  );


  return {
    structure: structure,
    nodes: neuronPositions,
    flatNodes: neuronPositions.reduce((arr, pos) => arr.concat(pos), [])
  }
}

function renderNeurons(nodeData) {
  let circleData = [];
  let radius = {min: 6, max: 12};
  let scale = d3.scaleSqrt()
    .domain(d3.extent(circleData, function (d) {
      return d.degree;
    }))
    .range([radius.min, radius.max]);

  let svg = d3.select('#d3-svg');
  let plot = svg.append("g").attr("id", "plot");

  plot.append("g").attr("id", "neurons")
    .selectAll("circle.neuron")
    .data(nodeData.flatNodes)
    .enter()
    .append("circle")
    .attr("r", 6)
    .attr("cx", function (d) {
      return d.x;
    })
    .attr("cy", function (d) {
      return d.y;
    })
    .style("fill", "white")
    .style("opacity", 0.6)
    .style("stroke", "#252525");
}




function renderLinks(data, network, cacheKey) {

  if (!(cacheKey in dataCache)) {
    dataCache[cacheKey] = data;
  }

  if (layout !== undefined) {
    layout.stop();
  }
  d3.selectAll("#d3-svg > g#plot > g#connections").remove();
  var radius = {min: 6, max: 12};

  let structure = network.structure;

  let svg = d3.select("#d3-svg");
  let plot = svg.append("g").attr("id", "plot");

  //
  // let width = +svg.attr("width");
  // let height = +svg.attr("height");

  let {
    width,
    height
  } = getSvgDimensions('d3-svg');

  let dataLinks = generateLinkData(data, network.nodes);


  let line = d3.line()
    .curve(d3.curveBundle)
    .x(function (d) {
      return d.x;
    })
    .y(function (d) {
      return d.y;
    });


  let bundle = generateLinks(network.flatNodes, dataLinks, width, height);


  let links = plot.append("g").attr("id", "connections")
    .selectAll("path.connection")
    .data(bundle.paths)
    .enter()
    .append("path")
    .attr("d", line)
    .style("fill", "none")
    .style("stroke", "#252525")
    .style("stroke-width", 0.5)
    // .style("stroke-width", function(d) {return d.length > 0 ? d[0].weight : 1; })
    // .style("stroke", function(d) { return d.length > 0 ? getColor(d[0].weight) : "#252525"})
    .style("stroke-opacity", 1.0);


  layout = d3.forceSimulation()
  // settle at a layout faster
    .alphaDecay(0.2)
    // nearby nodes attract each other
    .force("charge", d3.forceManyBody()
      .strength(10)
      .distanceMax(radius.max * 2)
    )
    // edges want to be as short as possible
    // prevents too much stretching
    .force("link", d3.forceLink()
      .strength(0.2)
      .distance(0)
    )
    .on("tick", function (d) {
      links.attr("d", line);
    })
    .on("end", function (d) {
      console.log("Layout complete "+ currentIndex);
      let advanceStep = currentIndex < step1Limit ? indexAutoAdvanceStep : indexAutoAdvanceStep2;
      let prevIndex = currentIndex;
      if (currentIndex < jsonMetaData.length && autoStep) {

        if (currentIndex < jsonMetaData.length - 1 && (currentIndex + advanceStep) >= jsonMetaData.length) {
          currentIndex = jsonMetaData.length - 1;
        }
        else {
          currentIndex += advanceStep;
        }


        let content = svg.html();
        console.log(" key ", cacheKey);

        htmlCache[cacheKey] = content;
        // console.log("svg node ", svg.node())
        // nodeCache[cacheKey] = svg.node();

        var config = {
          filename: `${datasetName}_${cacheKey}`,
        };
        d3_save_svg.save(svg.node(), config);

        document.getElementById('svg-2').innerHTML = htmlCache[cacheKey];
        svgKeys.push(cacheKey);
        let max = Object.keys(htmlCache).length;
        let fixedSvgSlider = document.getElementById('svg-slider');
        fixedSvgSlider.setAttribute("max", max - 1);
        fixedSvgSlider.setAttribute("value", currentIndex);
        console.log(" curr index ", currentIndex, " prev index ", prevIndex)

        if (currentIndex < jsonMetaData.length) {
          advanceToDataIndex(dataSource, jsonMetaData, currentIndex, network, document.getElementById('slider-output'));
        }
        else {

          let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(svgKeys.map(key => `${key}.svg`)));
          let dlAnchorElem = document.getElementById('downloadAnchorElem');
          dlAnchorElem.setAttribute("href",     dataStr     );
          dlAnchorElem.setAttribute("download", "images.json");
          dlAnchorElem.click();
        }
        // if (currentIndex >= jsonMetaData.length || prevIndex !== jsonMetaData.length - 1) {
        //   currentIndex = jsonMetaData.length - 1;
        //   advanceToDataIndex(dataSource, jsonMetaData, currentIndex, network, document.getElementById('slider-output'));
        // }
        // else {
        //   console.log("End")
        // }

      }
    });


  layout.nodes(bundle.nodes).force("link").links(bundle.links);

}


function filterData(data, networkFilter) {

  // let networkFilter = {
  //     blocks: {
  //       1: {
  //         layers: "all"
  //       },
  //       2: {
  //         layers: [0]
  //       }
  //     }
  //   };

  let currentBlock = -1;
  let blockCounter = -1;
  let blockCount = {};
  let layerCount = {};

  //Object.keys(networkFilter).sort((a, b) => a - b).map([])
  data.nodes.map((nodeId) => {
    let nodeData = parseId(nodeId);
    if (nodeData.blockIndex in networkFilter) {
      let block = networkFilter[nodeData.blockIndex];
      if (block.layers === 'all' || nodeData.layerIndex in block.layers) {
        blockCount[block]
        return
      }
    }

  })

  return data.edges.filter(({source: src, target: dest}) => {
    let srcData = parseId(src);
    let destData = parseId(dest);
  });
}

function advanceToDataIndex(source, jsonMetaData, selectedIndex, network, sliderOut) {
  sliderOut.innerHTML = jsonMetaData[selectedIndex].text;
  const filename = jsonMetaData[selectedIndex].filename;

  // Disable caching due to race condition
  if (filename in dataCache) {
    renderLinks(dataCache[filename], network, jsonMetaData[selectedIndex].filename)
  }
  else {
    d3.json(`${source}/${filename}`, (data) => renderLinks(data, network, jsonMetaData[selectedIndex].filename));
  }

}

function setSlider() {

  let slider = document.getElementById('epoch-slider');
  let currentFilenameIndex = slider.value;
  let filename = jsonMetaData[currentFilenameIndex].filename;
  let data = dataCache[filename];
  console.log("dataca ", dataCache, ' fi ', filename);

  d3.selectAll("#d3-svg > g#plot").remove();
  let network = buildNetwork(data, 0);
  let sliderOut = document.getElementById('slider-output');
  renderNeurons(network);
  renderLinks(data, network, jsonMetaData[currentFilenameIndex].filename);
  slider.removeEventListener("input", sliderEventListener);
  sliderEventListener = (e) => {
    advanceToDataIndex(dataSource, jsonMetaData, parseInt(e.target.value), network, sliderOut);
  };
  slider.addEventListener("input", sliderEventListener);
}

function livePlot(dataRange) {
  if ('batch' in dataRange) {

    let epochNumber = Math.floor(((dataRange.epoch.end - dataRange.epoch.start) / dataRange.epoch.step)) + 1;
    jsonMetaData = [...Array(epochNumber)].map((_, i) => {
        let end = i === dataRange.epoch.end && dataRange.batch.last !== undefined ? dataRange.batch.last
          : dataRange.batch.end;
        let batchNumber = Math.floor(((end - dataRange.epoch.start) / dataRange.batch.step) + 1);
        return [...Array(batchNumber)].map((_, j) => {

            let bIndex = dataRange.batch.start + j * dataRange.batch.step;
            return {filename: `epoch_${i}_batch_${bIndex}.json`, text: `Epoch ${i} Batch ${bIndex}`};
          }
        )
      }
    ).reduce((acc, x) => acc.concat(x), []);

  }
  else {
    jsonMetaData = ([...Array((dataRange.epoch.end - dataRange.epoch.start) / dataRange.epoch.step) + 1]).map((_, i) => {
      let eIndex = dataRange.epoch.start + i * dataRange.epoch.step;
      return {filename: `graph_epoch_${eIndex}.json`, text: `Epoch ${eIndex}`};
    });

    // Special case for mnist
    jsonMetaData = (
      [{filename: `graph_init.json`, text: `Init`}]
        .concat([...Array(3)].map((_, i) => {
          return {filename: `graph_epoch_${i}.json`, text: `Epoch ${i}`}
        }))
    ).concat(jsonMetaData)
  }

  console.log(jsonMetaData);


  d3.select('button#export').on('click', function () {
    let config = {
      filename: `${dataset}_${epoch}`,
    };
    console.log("svg save ", d3.select('#d3-svg').node())
    d3_save_svg.save(d3.select('#d3-svg').node(), config);
  });

  d3.select('button#exportAll').on('click', function () {
    // let key = Object.keys(htmlCache)[0];
    // var config = {
    //   filename: `${dataset}_${key}`,
    // };
    //
    // let d = document.createElement('div');
    //
    //
    // d.innerHTML =  `<svg width="1080" height="720" id="new-svg"></svg>`;
    //
    // let svg = d.children[0]//d.getElementById('new-svg');//document.createElement('svg');
    // svg.innerHTML = htmlCache[key];
    //
    // // console.log("svg ", d3.select(svg).node())
    //
    //
    // d3_save_svg.save(svg, config);
    // console.log(nodeCache)
    // Object.keys(nodeCache).forEach(key => {
    //   console.log("key " , key)
    //   var config = {
    //     filename: `${dataset}_${key}`,
    //   };
    //   htmlCache[key]
    //   d3_save_svg.save(, config);
    // })
  });


  let sliderOut = document.getElementById('slider-output');
  let selectedIndex = 0;
  let slider = document.getElementById('epoch-slider');

  let svgSlider = document.getElementById('svg-slider');
  slider.setAttribute("max", jsonMetaData.length - 1);
  sliderOut.innerHTML = jsonMetaData[selectedIndex].text;

  d3.json(`${dataSource}/${jsonMetaData[0].filename}`, (data) => {


    // filterData()
    let network = buildNetwork(data, 0);
    renderNeurons(network);
    renderLinks(data, network, jsonMetaData[0].filename);

    sliderEventListener = (e) => advanceToDataIndex(dataSource, jsonMetaData, parseInt(e.target.value), network, sliderOut);

    slider.addEventListener("input", sliderEventListener);

    // (e) => {
    //
    //
    //   // selectedIndex = parseInt(e.target.value);
    //   // sliderOut.innerHTML = jsonMetaData[selectedIndex].text;
    //   // const filename = jsonMetaData[selectedIndex].filename;
    //   //
    //   // // Disable caching due to race condition
    //   // if (filename in dataCache) {
    //   //   renderLinks(dataCache[filename], network, jsonMetaData[selectedIndex].filename)
    //   // }
    //   // else {
    //   //   d3.json(`${source}/${filename}`, (data) => renderLinks(data, network, jsonMetaData[selectedIndex].filename));
    //   // }
    //
    // });

    if (autoStep && svgSlider) {
      svgSlider.addEventListener("input", (e) => {
        let nameIndex = parseInt(e.target.value);
        if (nameIndex < svgKeys.length) {
          moveSvgToImageIndex(svgKeys[nameIndex]);
        }
      });
    }


  });


}

function moveSvgToImageIndex(selectedIndex) {
  // console.log("D ", htmlCache, "indx ", selectedIndex)
  document.getElementById('svg-2').innerHTML = htmlCache[selectedIndex];
  // let max = Object.keys(htmlCache).length;
  // let fixedSvgSlider = document.getElementById('svg-slider');
}

function getSvg(name, callback) {
  fetch(`${dataPrefix}/datasets/${datasetName}/svgs/${datasetName}_${name}`)
    .then(response => response.text())
    .then(svg => {
      if (callback) {
        callback(svg);
      }
               // /document.body.insertAdjacentHTML("afterbegin", svg)
    });
}


function fixedSvgs() {
  fetch(`${dataPrefix}/datasets/${datasetName}/svgs/images.json`)
    .then(response => {
      return response.json()
    })
    .then(data => {
      // Work with JSON data here
      let first = data[0];
      getSvg(first, (svg) => {
        document.getElementById('d3-svg').innerHTML = svg;
        let slider = document.getElementById('epoch-slider');
        slider.setAttribute("max", data.length - 1);
        let sliderOut = document.getElementById('slider-output');
        sliderOut.innerHTML = data[0];
        slider.addEventListener("input", (e) => {
          let index = parseInt(e.target.value);
          let fileName = data[index];
          sliderOut.innerHTML = fileName;
          getSvg(fileName, svg =>  document.getElementById('d3-svg').innerHTML = svg);
        });
      });

    })
    .catch(err => {
      // Do something for an error here
      console.error(`'/viz/${datasetName}/svgs/images.json' not found`);
    })
}

function debounce(func){
  let timer;
  return function(event){
    if(timer) clearTimeout(timer);
    timer = setTimeout(func,100,event);
  };
}

function onResize(e) {
  console.log("Resize");
  //dataCache = {};
  setSlider();
}

function start(urlPrefix = '.', dataset=null) {
  if (dataset) {
    datasetName = dataset;
  }
  window.onload = (e) => {
    console.log("Loaded");
    addEvents(urlPrefix);
  }
}


function addEvents(urlPrefix = '.') {

  console.log("Gott thing")

  window.addEventListener('resize', debounce(onResize));
  dataPrefix = urlPrefix;
  let urlParams = parseGet();
  const metadataFilename = `${urlPrefix}/datasets/metadata.json`;
  fetch(metadataFilename).then( response => response.json())
    .then(datasetRanges => {

    if ('data' in urlParams && !(urlParams.data in datasetRanges)) {
      document.getElementById("error").innerHTML = "Invalid dataset, make sure directory exists and ranges are added to" +
        " datasetRanges array.";
    }
    else {
      let blockIndex = 0;
      blockIndex = 'block' in urlParams ? urlParams.block : blockIndex;
      datasetName = 'data' in urlParams && urlParams.data in datasetRanges ? urlParams.data : datasetName;
      let dataRange = datasetRanges[datasetName];
      autoStep = 'auto' in urlParams && urlParams.auto.toLowerCase();
      let finalSvgs = 'svgs' in urlParams && urlParams.svgs.toLowerCase();

      let epoch = `epoch_3_batch_0`;
      let dataset = datasetName;
      dataSource = `${dataPrefix}/datasets/${dataset}`;

      console.log("Data ", dataRange);
      if (finalSvgs) {
        fixedSvgs();
      }
      else {
        console.log("Data ", dataRange);
        livePlot(dataRange);
      }

    }
  }).catch( error => {
    console.error(`'${metadataFilename}' not found `, error);
  });

  // let datasetRanges = {
  //   mnist_medium: {
  //     epoch: {
  //       start: 0,
  //       end: 3,
  //       step: 1
  //     },
  //     batch: {
  //       start: 0,
  //       end: 460,
  //       step: 10,
  //       last: 0
  //     }
  //   },
  //   mnist_small: {
  //     epoch: {
  //       start: 0,
  //       end: 3,
  //       step: 1
  //     },
  //     batch: {
  //       start: 0,
  //       end: 460,
  //       step: 10,
  //       last: 40
  //     }
  //   },
  //   mnist_graphs: {
  //     epoch: {
  //       start: 0,
  //       end: 1,
  //       step: 1
  //     },
  //     batch: {
  //       start: 0,
  //       end: 460,
  //       step: 10,
  //       last: 420
  //     }
  //   },
  //   graphs: {
  //     epoch: {
  //       start: 9,
  //       end: 249,
  //       step: 10
  //     }
  //   }
  // };


}


function getColor(v) {
  let k = (v < 0) ? "DarkBlue" : "DarkGreen";
  return k;
}

