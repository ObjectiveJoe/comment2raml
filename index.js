var fs = require('fs');
var pjson = require('./package.json');
var Q = require('q');

/**
 * Render the source RAML object using the config's processOutput function
 *
 * The config object should contain at least the following property:
 * processRamlObj: function that takes the raw RAML object and returns a promise with the rendered HTML
 *
 * @param {(String|Object)} source - The source RAML file. Can be a filename, url, contents of the RAML file,
 * or an already-parsed RAML object.
 * @param {Object} config
 * @param {Function} config.processRamlObj
 * @returns a promise
 */
function parse(source, outfile, ramlMarker) {
  var comment2ramlVersion = pjson.version;

  fs.readFile(source, 'utf8', function (err,data) {
    if (err) {
      return console.log(err);
    }

    var bufferString, bufferStringSplit;
    bufferString = data.toString(); 
    bufferStringSplit = bufferString.split('\n'); 

    var commentGroups = [];
    var i = 0;
    while (i < bufferStringSplit.length) {
      i = readCommentGroup(bufferStringSplit, commentGroups, i, ramlMarker)
    }

    var ramls = []; 
    readRAMLS(commentGroups, ramls, ramlMarker);
    if (outfile) {
      writeRAMLSToFile(ramls, outfile, ramlMarker);
    } else {
    printRAMLS(ramls, ramlMarker);
  }
  });
}

function printRAMLS(ramls, ramlMarker)
{
  var ramlPostMarkerRx  = new RegExp('[ \t]*' + ramlMarker + '[\\t]*[\\s\\S]');      // RAML: at text start

  for (var k=0; k < ramls.length; k++) {
    var postRamlMatch = ramls[k].match(ramlPostMarkerRx);
    if (postRamlMatch != null && 1 <= postRamlMatch.length) {
      console.log(ramls[k].slice(postRamlMatch[0].length));
    }
  }
}

function writeRAMLSToFile(ramls, outfile, ramlMarker)
{
  var ramlPostMarkerRx  = new RegExp('[ \t]*' + ramlMarker + '[\\t]*[\\s\\S]');      // RAML: at text start

  for (var k=0; k < ramls.length; k++) {
    var postRamlMatch = ramls[k].match(ramlPostMarkerRx);
    if (postRamlMatch != null && 1 <= postRamlMatch.length) {
      if (k==0) {
        fs.writeFileSync(outfile, ramls[k].slice(postRamlMatch[0].length), 'utf8');
      } else {
        fs.appendFileSync(outfile, ramls[k].slice(postRamlMatch[0].length), 'utf8');
      }
    }
  }
}

function readRAMLS(commentGroups, ramls, ramlMarker) {
  var ramlMarkerRx  = new RegExp('[ \t]*' + ramlMarker);      // RAML: at text start

  for (var i = 0; i < commentGroups.length; i++) {
    var commentGroup = commentGroups[i];
    var foundRAML = false;

    if (isCStyleCommentGroup(commentGroup)) {
      var commenttext = combineCStyleCommentGroup(commentGroup);
      var cstylematch = commenttext.match(ramlMarkerRx);
      if (cstylematch != null && 1 <= cstylematch.length) {
          ramls.push(commenttext);
        }
    } 
    else 
    {
      if (isCPlusCommentGroup(commentGroup)) {
        var commenttext = getTextFromCPlusCommentGroup(commentGroup);
        var cplusmatch = commenttext.match(ramlMarkerRx);

        if (cplusmatch != null && 1 <= cplusmatch.length) {
          ramls.push(commenttext);
        }
      }
    }
  }
}

function isCPlusCommentGroup(commentGroup) {
  var foundCommentStart = false;
  var foundCommentEnd = false;

  for (k=0; k < commentGroup.length; k++) {
    var commentline = commentGroup[k];

    if (k == 0 && isCPlusCommentStart(commentline)) {
      foundCommentStart = true;
    }

    if (foundCommentStart) {
      return true;
    }
  }

  return false;
}

function isCStyleCommentGroup(commentGroup) {
  var foundCommentStart = false;
  var foundCommentEnd = false;

  for (k=0; k < commentGroup.length; k++) {
    var commentline = commentGroup[k];

    if (k == 0 && isCStyleCommentStart(commentline)) {
      foundCommentStart = true;
    }

    if (k == commentGroup.length - 1 && isCStyleCommentEnd(commentline)) {
      foundCommentEnd = true;
    }

    if (foundCommentStart && foundCommentEnd) {
      return true;
    }
  }

  return false;
}

function isCPlusCommentStart(commentline) {
  indexOfCurrentStart = commentline.indexOf('//');
  if (indexOfCurrentStart >= 0) {
    return true;
  }

  return false;
}

function isCStyleCommentStart(commentline) {
  indexOfCurrentStart = commentline.indexOf('/*');
  if (indexOfCurrentStart >= 0) {
    return true;
  }

  return false;
}

function isCStyleCommentEnd(commentline) {
  indexOfCurrentStart = commentline.indexOf('*/');
  if (indexOfCurrentStart >= 0) {
    return true;
  }

  return false;
}

// This removes on starting /* and trailing */ as well as removes leading ' '
function combineCStyleCommentGroup(commentGroup, ramlMarker) {
  var ramlMarkerRxCStyle  = new RegExp('([ \t]*' + ramlMarker + '[.\\s\\S]+?(?=\\*/))');      // RAML: at text start
  var commenttext = '';
  for (k=0; k < commentGroup.length; k++) {
    var commentline = commentGroup[k];
    if (commentline.length > 0 && commentline[0] == ' ') {
      commentline = commentline.slice(1)
    }
    commenttext = commenttext + commentline + '\n';
  }

  var cstylematch = commenttext.match(ramlMarkerRxCStyle);
  if (cstylematch != null && 1 <= cstylematch.length) {
    commenttext = cstylematch[0];
    if (commenttext.length > 0 && commenttext[0] == ' ') {
      commenttext = cstylematch[0].slice(1)
    }
  }
  return commenttext;
}

// getTextFromCPlusCommentGroup removes the '//' comment marker at beginning of all lines
function getTextFromCPlusCommentGroup(commentGroup) {
  var commenttext = '';
  for (k=0; k < commentGroup.length; k++) {
    var commentline = commentGroup[k];
    switch (commentline[1]) {
      case '/':
        commentline = commentline.slice(2);
        if (commentline.length > 0 && commentline[0] == ' ') {
          commentline = commentline.slice(1)
        }
        break;
    }
    commenttext = commenttext + commentline + '\n';
  }
  return commenttext;
}

function readCommentGroup(bufferStringSplit, commentGroups, i, ramlMarker) {
  var AtEndOfDocument = false;
  var iInitial = i;

  //At start of this method we can assume we are not in a comment group
  // Two cases exist: Starting comment group or not

  //Check for end of file first
  if (i == bufferStringSplit.length) {
    i  = i + 1;
    AtEndOfDocument = true;
    return i;
  }

  var currentline = bufferStringSplit[i];

  if (currentline.length <= 1) { 
    i = i + 1;
    return i;
  }

  var indexOfCPlusStyle = -1;
  var indexOfCStyle = -1;

  indexOfCPlusStyle = currentline.indexOf('//');
  indexOfCStyle = currentline.indexOf('/*');

  if (indexOfCStyle == -1 && indexOfCPlusStyle == -1) { 
    i = i + 1;
    return i;
  }

  if (indexOfCStyle >= 0 && indexOfCPlusStyle == -1) {
    i = ProcessCStyleComment(bufferStringSplit, commentGroups, i)
  }

  if (indexOfCPlusStyle >= 0 && indexOfCStyle == -1) {
    i = ProcessCPlusComment(bufferStringSplit, commentGroups, i);
  }

  if (indexOfCPlusStyle >= 0 && indexOfCStyle >= 0) {
    if (indexOfCStyle < indexOfCPlusStyle) {
      i = ProcessCStyleComment(bufferStringSplit, commentGroups, i, ramlMarker)

    }
    else {
      i = ProcessCPlusComment(bufferStringSplit, commentGroups, i);
    }
  }

  return i;
}


function ProcessCPlusComment(bufferStringSplit, commentGroups, i) {
  var commentGroup= [];
  var AtEndOfDocument = false;

  if (i == bufferStringSplit.length) {
    AtEndOfDocument = true;
    return i;
  }

  var currentline = bufferStringSplit[i];

  if (currentline.length <= 1) {
      console.error('ProcessCPlusComment: not in comment group, not starting comment group as line is too short');
      return;
    }

  var indexOfCPlusStyle = -1;
  var indexOfCStyle = -1;

  indexOfCPlusStyle = currentline.indexOf('//');
  indexOfCStyle = currentline.indexOf('/*');

  var isCPlusComment = false;

  if (indexOfCPlusStyle >= 0 && (indexOfCStyle == -1 || indexOfCStyle > indexOfCPlusStyle)) {
    isCPlusComment = true;
  }

  if (isCPlusComment == false) {
    console.error('ProcessCPlusComment: first line is not a cplus comment so throwing error');
    return;
  }

  if (isCPlusComment == true) {
    commentGroup.push(currentline);
  }

  i = i + 1;

  // continue checking for comments in comment group
  while (i < bufferStringSplit.length) {
    isCPlusComment = false;
    currentline = bufferStringSplit[i];

    indexOfCPlusStyle = currentline.indexOf('//');
    indexOfCStyle = currentline.indexOf('/*');

    if (indexOfCPlusStyle >= 0 && (indexOfCStyle == -1 || indexOfCStyle > indexOfCPlusStyle)) {
      isCPlusComment = true;
    }

    if (isCPlusComment == false) {
      break;
    } 

    if (isCPlusComment == true) {
      commentGroup.push(currentline);
      }

    i = i + 1;
  }

  if (commentGroup.length > 0) {
    commentGroups.push(commentGroup);
  }

  return i;

}

//Process c style comment  such as /*   text */, maybe over many lines
// So we need to find start and ending comment, over one or multiple lines

function ProcessCStyleComment(bufferStringSplit, commentGroups, i) {
  var amInAComment = false;
  var startCommentFound = false;
  var indexOfCurrentStart = -1;
  var endCommentFound = false;
  var indexOfCurrentEnd = -1;
  var foundAnotherStart = false;
  var indexOfNextStart = -1;
  var commentGroup= [];
  var startedComentGroup = false;
  var endOfCommentEncountered = false;
  var AtEndOfDocument = false;
  var lineIndex = 0;
  var currentSlice = '';
  var startSliceIndext = 0;
  var endSliceIndext = -1;

  if (i == bufferStringSplit.length) {
    AtEndOfDocument = true;
    return i;
  }

  var currentline = bufferStringSplit[i];

  //Set defaults
  startSliceIndext = 0;
  endSliceIndext = currentline.length;

  if (amInAComment == false && currentline.length <= 1) {
    i = i + 1;
    console.error('ProcessCStyleComment: not in comment group, not starting comment group as line is too short');
    return i;
  }

  indexOfCurrentStart = currentline.indexOf('/*');
  if (indexOfCurrentStart >= 0) {
    startCommentFound = true;
    amInAComment = true;
    startSliceIndext = indexOfCurrentStart;
  }
  else {
    console.error('ProcessCStyleComment: Did not find starting comment on line ' + i.toString() + ': "' + currentline + '"');
    startCommentFound = false;
    i = i + 1;
    return;
  }

  indexOfCurrentEnd = currentline.indexOf('*/');
  if (indexOfCurrentEnd > indexOfCurrentStart + 1 ) {
    endCommentFound = true;
    amInAComment = false;
    endSliceIndext = indexOfCurrentEnd+2;
    }
  else {
    endSliceIndext = currentline.length;
  }

  currentSlice = currentline.slice(startSliceIndext, endSliceIndext);
  commentGroup.push(currentSlice);


  i = i + 1;

  //While we have not found the end comment...
  while (i < bufferStringSplit.length && endCommentFound == false) {
    currentline = bufferStringSplit[i];

    //Set defaults
    startSliceIndext = 0;
    endSliceIndext = currentline.length;;


    if (amInAComment == true && currentline.length <= 1) {
      commentGroup.push(currentline);
      i = i + 1;
      continue;
    }

    if (amInAComment == true) {
      indexOfCurrentEnd = currentline.indexOf('*/');
      if (indexOfCurrentEnd >= 0) {
        endCommentFound = true;
        amInAComment = false;
        endSliceIndext = indexOfCurrentEnd + 2;
        }
      else {
        endSliceIndext = currentline.length;
      }
    }

    currentSlice = currentline.slice(startSliceIndext, endSliceIndext);
    commentGroup.push(currentSlice);

   if (endCommentFound == false && amInAComment == true) {
      i = i + 1;
      continue;
    }

    if (amInAComment == false && endCommentFound == true)
    {
      i = i + 1;
      break;
    }
  }


  if (commentGroup.length > 0) {
    commentGroups.push(commentGroup);
  }

  return i;
}


module.exports = {
  parse: parse
};

if (require.main === module) {
  console.log('This script is meant to be used as a library. You probably want to run bin/raml2html if you\'re looking for a CLI.');
  process.exit(1);
}
