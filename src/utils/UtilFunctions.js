export const addAttributesToComments = (comments) => {
  return comments.map((elem) => {

    var newElem = null;

    elem.child = null;
    elem.opened = true;
    elem.children = null;
    
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
  return comments.map((comment) => {
    
    let childComment = null;

    for(var i = 0; i < comments.length; i++) {
      if (comments[i].id === child.id) {
        childComment = comments[i];
      }
    }

    if(comment.id === child.comments_id) {
      if(comment.child === null) {
        comment.child = childComment;
      } else {
        if(comment.child.id === child.id) {
          comment.child = null;
        } else {
          comment.child = childComment;
        }
      }
    }

    return comment;
  })
}

export const organizeComments = (comments, oldComments = null, newChild = null) => {
  let commentsWithAttributes = [];

  if(oldComments === null) 
    commentsWithAttributes = calculateChildren(comments);
  else {
    let commentsActualState = calculateOldState(comments, oldComments);
    let commentsWithNewChild = calculateChildren(commentsActualState);
    commentsWithAttributes = addNewChildren(commentsWithNewChild, newChild);
  }

  return commentsWithAttributes;
}

const calculateChildren = (comments) => {
  return comments.map((comment) => {
    let postComment = null;
    comment.children = []
    for(var i = 0; i < comments.length; i++) {
      if(comments[i].comments_id !== null && comment.id === comments[i].comments_id) { //this means the comment[i] is a son of commentc
        comment.children.push(comments[i]);
      }
    }

    postComment = { ...comment }
    return postComment;
  })
}

const calculateOldState = (comments, oldComments) => {
  return comments.map((item, i) => {
    if(oldComments[i] !== undefined && oldComments[i] !== null) { //oldComments is not null or undefined means there was a previous state;
      if(oldComments[i].child !== null) { // if oldcomments has a child we need to find which child is this in the new tree;
        for(var j = 0; j < comments.length; j++) {
          if(comments[j].id === oldComments[i].child.id) { //if the comment child exists in the new tree then stiore it;
            item.child = comments[j];
            break;
          }
        }
      }

      item.opened = oldComments[i].opened;
      return item;
    } else {
      return item
    }
  })
}

const addNewChildren = (comments, newChild) => {
  let actualChild = null;
  
  for(var i = 0; i < comments.length; i++) {
    if(comments[i].id === newChild.id) {
      actualChild = comments[i];
    }
  }

  return comments.map((item) => {
    if(item.id === actualChild.comments_id) {
      item.child = actualChild;
    }

    return item;
  })
}


