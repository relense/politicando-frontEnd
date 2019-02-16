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

export const renderLogo = (partyName, mobile = false, tags = false) => {
  let imageName = "";
  let partyUrl = "";
  let partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '70px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }


  switch(partyName) {
    case "PS":
      imageName = "ps_logo.png";
      partyUrl = "https://ps.pt/";
      break;
    case "PSD":
      imageName = "psd_logo.png";
      partyUrl = "https://www.psd.pt/";
      break;
    case "BE":
      imageName = "be_logo.png";
      partyUrl = "https://www.bloco.org/";
      break;
    case "CDS-PP":
      imageName = "cds_logo.png";
      partyUrl = "http://www.cds.pt/";
      break;
    case "PCP":
      imageName = "pcp_logo.png";
      partyUrl = "http://www.pcp.pt/";
      break;
    case "PEV":
      imageName = "pev_logo.png";
      partyUrl = "http://www.osverdes.pt/";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '100px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "PAN":
      imageName = "pan_logo.png";
      partyUrl = "https://www.pan.com.pt/";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '100px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "JPP":
      imageName = "jpp_logo.png";
      partyUrl = "http://juntospelopovo.pt/";
      break;
    case "PPM":
      imageName = "ppm_logo.png";
      partyUrl = "http://www.ppm.pt/";
      break;
    case "PTP":
      imageName = "ptp_logo.png";
      partyUrl = "";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '100px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "MPT":
      imageName = "mpt_logo.png";
      partyUrl = "http://mpt.pt/";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '100px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "PDR":
      imageName = "pdr_logo.png";
      partyUrl = "https://pdr.pt/";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '100px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "L":
      imageName = "l_logo.png";
      partyUrl = "https://partidolivre.pt/";
      break;
    case "NC":
      imageName = "nc_logo.png";
      partyUrl = "http://noscidadaos.pt/";
      partieLogo = !mobile ? { maxWidth: '200px', maxHeight: '90px' } : { maxWidth: '35px', maxHeight: '35px', paddingRight: '10px' }
      break;
    case "PCTP":
      imageName = "pctp_logo.png";
      partyUrl = "http://lutapopularonline.org/index.php/editorial";
      break;
    case "POUS":
      imageName = "pous_logo.png";
      partyUrl = "https://pous4.wordpress.com/";
      break;
    case "PNR":
      imageName = "pnr_logo.png";
      partyUrl = "http://www.pnr.pt/";
      break;
    case "PLD":
      imageName = "pld_logo.png";
      partyUrl = "https://mudarportugal.pt/";
      break;
    case "PPV":
      imageName = "ppv_cdc_logo.png";
      partyUrl = "http://portugalprovida.blogspot.com/";
      break;
    case "MAS":
      imageName = "mas_logo.png";
      partyUrl = "http://www.mas.org.pt/";
      break;
    case "PURP":
      imageName = "purp_logo.png";
      partyUrl = "https://www.purp.pt/";
      break;
    case "IL":
      imageName = "il_logo.png";
      partyUrl = "https://iniciativaliberal.pt/";
      break;
    case "A":
      imageName = "alianca_logo.png";
      partyUrl = "https://alianca.com.pt/";
      break;
    case "RIR":
      imageName = "progress.png";
      partyUrl = "";
      break;
    default:
      imageName= "ps_logo.png"
  }

  if(tags)
    partieLogo = { maxWidth: '20px', maxHeight: '20px', paddingRight: '2px' }

  return { imageName: imageName, partieLogo: partieLogo, partyUrl: partyUrl}
}
