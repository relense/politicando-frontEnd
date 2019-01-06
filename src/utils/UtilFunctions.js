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

    if(comment.children !== null) {
      comment.children = openCloseComment(comment.children, opened, commentId);
    }
     
     return comment
  })
}

export const changeCommentChild = (comments, child) => {
  let changedComments = comments.map((comment) => {
    if(comment.id === child.comments_id) {
      if(comment.child === null) {
        comment.child = child;
      } else {
        if(comment.child.id === child.id) {
          comment.child = null;
        } else {
          comment.child = child;
        }
      }
    }

    if(comment.children !== null) {
      comment.children = changeCommentChild(comment.children, child);
    }

    return comment;
  })

  return changedComments;
}

export const organizeComments = (comments, oldComments = null, newChild = null) => {
  let commentsWithAttributes = [];

  if(oldComments === null) 
    commentsWithAttributes = calculateChildren(comments);
  else {
    let commentsActualState = calculateOldState(comments, oldComments);
    let commentsWithChild = addNewChildren(commentsActualState, newChild);
    commentsWithAttributes = calculateChildren(commentsWithChild)
  }

  return commentsWithAttributes;
}

const calculateChildren = (comments) => {
  return comments.map((comment) => {
    let postComment = null;
    comment.children = []
    comments.forEach((elem) => {
      if(elem.comments_id !== null && comment.id === elem.comments_id) { //this means the comment[i] is a son of comment
        comment.children.push(elem);
      }
    })

    postComment = { ...comment }
    return postComment;
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


