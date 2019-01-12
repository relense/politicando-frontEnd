import * as types from './actionTypes';
import { apiUrls } from '../../api/apiUrls';
import { get, post } from '../../api/Api';
import { openCloseComment, changeCommentChild, organizeComments, addAttributesToComments } from '../../utils/UtilFunctions';

export function reveiveArticle(article) {
    return {
        type: types.GET_ARTICLE,
        currentArticle: article
    }
}

export function receiveArticleComments(comments) {
    return {
        type: types.GET_ARTICLE_COMMENTS,
        currentArticleComments: comments
    }
}

export function setComment(comment) {
    return {
        type: types.SET_COMMENT,
        comment: comment,
    }
}

export function setEditorIndex(editorIndex) {
    return {
        type: types.SET_EDITOR_INDEX,
        editorIndex: editorIndex
    }
}

export function setReply(value) {
    return {
        type: types.SET_REPLY,
        reply: value
    }
}

export const asyncLoadArticle = (articleId) => {
    return async function(dispatch){
        try {
            await get(apiUrls.getArticle.replace('{article_id}', articleId)).then((article) => {
                dispatch(reveiveArticle(article))
            })
        } catch (error) {
            console.log(error);
        }
    }
}

export const asyncLoadArticleComments = (articleId) => {
    return async function(dispatch){
        try {
            await get(apiUrls.getArticleComments.replace('{article_id}', articleId)).then((comments) => {
                dispatch(receiveArticleComments(organizeComments(addAttributesToComments(comments), null, null)));
            });
        } catch (error) {
            console.log(error);
        }
    }
}

export const asyncLoadNewArticleComments = (articleId, oldComments, newComment) => {
    return async function(dispatch){
        try {
            await get(apiUrls.getArticleComments.replace('{article_id}', articleId)).then((newComments) => {
                dispatch(receiveArticleComments(organizeComments(addAttributesToComments(newComments), oldComments, newComment)));
            });
        } catch (error) {
            console.log(error);
        }
    }
}

export function asyncSetComments(comment, articleId, comments) {
    return async function(dispatch){
        try {            
            await dispatch(asyncPostComment(articleId, comment, comments));
            let newComment = comment.comment = "";
            await dispatch(asyncLoadArticle(articleId));
            await dispatch(setComment(newComment));
        } catch (error) {
            console.log(error);
        }
    }
}

export const asyncPostComment = (articleId, comment, oldComments) => {
    return async function(dispatch) {
        try {
            let user = comment.username ? comment.username : null;
            let content = comment.comment;
            let commentType = comment.commentType;
            let commentId = comment.id ? comment.id : null;
            
            const payload = {
                comments: {
                    username: user,
                    comment: content,
                    commentType: commentType,
                    article_id: articleId,
                    comments_id: commentId
                }
            }
            
            return await post(apiUrls.createComment, payload).then((newComment) => {
                dispatch(asyncLoadNewArticleComments(articleId, oldComments, newComment));
            });
        } catch (error) {
            console.log(error);
        }
    }
}

export const asyncSetReply = (commentId, currentEditorIndex) => {
    return function(dispatch) {
        try {
            if(currentEditorIndex !== commentId || currentEditorIndex === null) {
                dispatch(setReply(true))
                dispatch(setEditorIndex(commentId));
            } else {
                dispatch(setReply(false))
                dispatch(setEditorIndex(null));
            }
        } catch (error) {
            console.log(error);
        }        
    }
}

export const openCloseCommentBox = (comments, opened, commentId) => {
    return function(dispatch) {
        try {
            dispatch(receiveArticleComments(openCloseComment(comments, opened, commentId)));
        } catch (error) {
            console.log(error)
        }
    }
}

export const setChildComments = (comments, child) => {
    return function(dispatch) {
        try {
            dispatch(receiveArticleComments(changeCommentChild(comments, child)));
        } catch (error) {
            console.log(error)
        }
    }
}