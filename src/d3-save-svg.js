(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('d3-save-svg', ['exports'], factory) :
  factory((global.d3_save_svg = {}));
}(this, function (exports) { 'use strict';

  function download (svgInfo, filename) {
    window.URL = (window.URL || window.webkitURL);
    var blob = new Blob(svgInfo.source, {type: 'text\/xml'});
    var url = window.URL.createObjectURL(blob);
    var body = document.body;
    var a = document.createElement('a');

    body.appendChild(a);
    a.setAttribute('download', filename + '.svg');
    a.setAttribute('href', url);
    a.style.display = 'none';
    a.click();
    a.parentNode.removeChild(a);

    setTimeout(function() {
      window.URL.revokeObjectURL(url);
    }, 10);
  }

  var prefix = {
    svg: 'http://www.w3.org/2000/svg',
    xhtml: 'http://www.w3.org/1999/xhtml',
    xlink: 'http://www.w3.org/1999/xlink',
    xml: 'http://www.w3.org/XML/1998/namespace',
    xmlns: 'http://www.w3.org/2000/xmlns/',
  };

  function setInlineStyles (svg) {

    // add empty svg element
    var emptySvg = window.document.createElementNS(prefix.svg, 'svg');
    window.document.body.appendChild(emptySvg);
    var emptySvgDeclarationComputed = window.getComputedStyle(emptySvg);

    // hardcode computed css styles inside svg
    var allElements = traverse(svg);
    var i = allElements.length;
    while (i--) {
      explicitlySetStyle(allElements[i]);
    }

    emptySvg.parentNode.removeChild(emptySvg);

    function explicitlySetStyle(element) {
      var cSSStyleDeclarationComputed = window.getComputedStyle(element);
      var i;
      var len;
      var key;
      var value;
      var computedStyleStr = '';

      for (i = 0, len = cSSStyleDeclarationComputed.length; i < len; i++) {
        key = cSSStyleDeclarationComputed[i];
        value = cSSStyleDeclarationComputed.getPropertyValue(key);
        if (value !== emptySvgDeclarationComputed.getPropertyValue(key)) {
          // Don't set computed style of width and height. Makes SVG elmements disappear.
          if ((key !== 'height') && (key !== 'width')) {
            computedStyleStr += key + ':' + value + ';';
          }

        }
      }

      element.setAttribute('style', computedStyleStr);
    }

    function traverse(obj) {
      var tree = [];
      tree.push(obj);
      visit(obj);
      function visit(node) {
        if (node && node.hasChildNodes()) {
          var child = node.firstChild;
          while (child) {
            if (child.nodeType === 1 && child.nodeName != 'SCRIPT') {
              tree.push(child);
              visit(child);
            }

            child = child.nextSibling;
          }
        }
      }

      return tree;
    }
  }

  function preprocess (svg) {
    svg.setAttribute('version', '1.1');

    // removing attributes so they aren't doubled up
    svg.removeAttribute('xmlns');
    svg.removeAttribute('xlink');

    // These are needed for the svg
    if (!svg.hasAttributeNS(prefix.xmlns, 'xmlns')) {
      svg.setAttributeNS(prefix.xmlns, 'xmlns', prefix.svg);
    }

    if (!svg.hasAttributeNS(prefix.xmlns, 'xmlns:xlink')) {
      svg.setAttributeNS(prefix.xmlns, 'xmlns:xlink', prefix.xlink);
    }

    setInlineStyles(svg);

    var xmls = new XMLSerializer();
    var source = xmls.serializeToString(svg);
    var doctype = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
    var rect = svg.getBoundingClientRect();
    var svgInfo = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      class: svg.getAttribute('class'),
      id: svg.getAttribute('id'),
      childElementCount: svg.childElementCount,
      source: [doctype + source],
    };

    return svgInfo;
  }

  function converterEngine(input) { // fn BLOB => Binary => Base64 ?
    var uInt8Array = new Uint8Array(input);
    var i = uInt8Array.length;
    var biStr = []; //new Array(i);
    while (i--) {
      biStr[i] = String.fromCharCode(uInt8Array[i]);
    }

    var base64 = window.btoa(biStr.join(''));
    return base64;
  };

  function getImageBase64(url, callback) {
    var xhr = new XMLHttpRequest(url);
    var img64;
    xhr.open('GET', url, true); // url is the url of a PNG/JPG image.
    xhr.responseType = 'arraybuffer';
    xhr.callback = callback;
    xhr.onload = function() {
      img64 = converterEngine(this.response); // convert BLOB to base64
      this.callback(null, img64); // callback : err, data
    };

    xhr.onerror = function() {
      callback('B64 ERROR', null);
    };

    xhr.send();
  };

  function isDataURL(str) {
    var uriPattern = /^\s*data:([a-z]+\/[a-z0-9\-]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;
    return !!str.match(uriPattern);
  }

  function save(svgElement, config) {
    if (svgElement.nodeName !== 'svg' || svgElement.nodeType !== 1) {
      throw 'Need an svg element input';
    }

    var config = config || {};
    var svgInfo = preprocess(svgElement, config);
    var defaultFileName = getDefaultFileName(svgInfo);
    var filename = config.filename || defaultFileName;
    var svgInfo = preprocess(svgElement);
    download(svgInfo, filename);
  }

  function embedRasterImages(svg) {

    var images = svg.querySelectorAll('image');
    [].forEach.call(images, function(image) {
      var url = image.getAttribute('href');

      // Check if it is already a data URL
      if (!isDataURL(url)) {
        // convert to base64 image and embed.
        getImageBase64(url, function(err, d) {
          image.setAttributeNS(prefix.xlink, 'href', 'data:image/png;base64,' + d);
        });
      }

    });

  }

  function getDefaultFileName(svgInfo) {
    var defaultFileName = 'untitled';
    if (svgInfo.id) {
      defaultFileName = svgInfo.id;
    } else if (svgInfo.class) {
      defaultFileName = svgInfo.class;
    } else if (window.document.title) {
      defaultFileName = window.document.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    }

    return defaultFileName;
  }

  var version = "0.0.2";

  exports.version = version;
  exports.save = save;
  exports.embedRasterImages = embedRasterImages;

}));