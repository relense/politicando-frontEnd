export const addAttributesToComments = (comments) => {
  return comments.map((elem) => {

    var newElem = null;

    elem.child = null;
    elem.opened = true;
    elem.children = 0;
    
    newElem = { ...elem };

    return newElem;
  });
}

export const openCloseComment = (comments, opened, commentId) => {
  return comments.map((comment) => {
    if(comment.id === commentId){
      comment.opened = !opened
      comment.child = null
    }

     return comment
  })
}

export const changeCommentChild = (comments, child) => {

  let actualChild = null;

  comments.forEach((elem) => {
    if(elem.id === child.id) {
      actualChild = elem;
    }
  })

  var stuff = comments.map((comment) => {
    if(comment.id === child.comments_id) {
      if(comment.child === null) {
        comment.child = actualChild;
      } else if(comment.child.id !== actualChild.id) {
        comment.child = actualChild;
      } else if (comment.child.id === actualChild.id) {
        comment.child = null;
      }
    }

    return comment;
  });

  return stuff;
}

export const organizeComments = (comments, oldComments = null, newChild = null) => {
  let commentsWithAttributes = [];

  if(oldComments === null) {
    commentsWithAttributes = calculateChildren(comments);
  } else {
    let commentsActualState = calculateOldState(comments, oldComments);
    let commentsWithChild = addNewChildren(commentsActualState, newChild);
    commentsWithAttributes = calculateChildren(commentsWithChild);
  }

  return commentsWithAttributes;
}

const calculateChildren = (comments) => {
  return comments.map((comment) => {
    comments.forEach((elem) => {
      if(elem.comments_id !== null && comment.id === elem.comments_id) { //this means the comment[i] is a son of comment
        comment.children += 1;
      }
    })

    return comment;
  })
}

const calculateOldState = (comments, oldComments) => {
  return comments.map((item, i) => {
    if(oldComments[i] !== undefined && oldComments[i] !== null) { //oldComments is not null or undefined means there was a previous state;
      if(oldComments[i].child !== null) { // if oldcomments has a child we need to find which child is this in the new tree;
        comments.forEach((elem) => {
          if(elem.id === oldComments[i].child.id) { //if the comment child exists in the new tree then stiore it;
            item.child = elem;
          }
        })
      }

      item.opened = oldComments[i].opened;
      return item;
    } else {
      return item
    }
  })
}

export const addNewChildren = (comments, newChild) => {
  let actualChild = null;
  
  comments.forEach((elem) => {
    if(elem.id === newChild.id) {
      actualChild = elem;
    }
  })

  return comments.map((item) => {
    if(item.id === actualChild.comments_id) {
      item.child = actualChild;
      return item;
    }

    return item;
  })
}

export const renderLogo = (partyName, mobile = false) => {
  let imageName = "";

  let partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '70px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px'}

  switch(partyName) {
    case "PS":
      imageName = "ps_logo.png";
      break;
    case "PSD":
      imageName = "psd_logo.png";
      break;
    case "BE":
      imageName = "be_logo.png";
      break;
    case "CDS-PP":
      imageName = "cds_logo.png";
      break;
    case "PCP":
      imageName = "pcp_logo.png";
      break;
    case "PEV":
      imageName = "pev_logo.png";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '100px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "PAN":
      imageName = "pan_logo.png";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '100px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "JPP":
      imageName = "jpp_logo.png";
      break;
    case "PPM":
      imageName = "ppm_logo.png";
      break;
    case "PTP":
      imageName = "ptp_logo.png";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '100px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "MPT":
      imageName = "mpt_logo.png";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '100px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "PDR":
      imageName = "pdr_logo.png";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '100px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "L":
      imageName = "l_logo.png";
      break;
    case "NC":
      imageName = "nc_logo.png";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '90px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "PCTP":
      imageName = "pctp_logo.png";
      break;
    case "POUS":
      imageName = "pous_logo.png";
      break;
    case "PNR":
      imageName = "pnr_logo.png";
      break;
    case "PLD":
      imageName = "pld_logo.png";
      break;
    case "PPV":
      imageName = "ppv_cdc_logo.png";
      break;
    case "MAS":
      imageName = "mas_logo.png";
      break;
    case "PURP":
      imageName = "purp_logo.png";
      break;
    case "IL":
      imageName = "il_logo.png";
      break;
    case "A":
      imageName = "alianca_logo.png";
      break;
    default:
      imageName= "ps_logo.png"
  }
  return { imageName: imageName, partieLogo: partieLogo}
}
