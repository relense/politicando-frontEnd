
export const addToChildren = (children) => {
  let newChildren = children.map((child) => {
      let comment = child;
      comment.child = null;
      comment.opened = true
      if(comment.children) {
        addToChildren(comment.children)
      }

      return comment
  })

  return newChildren;
}


export const changeOneChildren = (comments, opened, commentId) => {
  let newComments = comments.map((comment) => {
    if(comment.id === commentId)
      comment.opened = opened
      comment.child = null

    // if(comment.children) 
    //   closeChildren(comment.children, opened)
    
      return comment
  })

  return newComments;
}


export const closeChildren = (children, opened) => {
  let newChildren = children.map((child) => {
    child.opened = opened;
    child.child = null

    if(child.children) {
      child.children = closeChildren(child.children)
    }

    return child;
  })

  return newChildren;
}