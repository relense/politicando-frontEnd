import * as types from './actionTypes';
import { apiUrls } from '../../api/apiUrls';
import { get, post } from '../../api/Api';
import { addToChildren, changeOneChildren } from '../../utils/UtilFunctions';

export function reveiveArticle(article) {
    return {
        type: types.GET_ARTICLE,
        currentArticle: article
    }
}

export function receiveArticleComments(comments) {
    let newComments = addToChildren(comments);

    return {
        type: types.GET_ARTICLE_COMMENTS,
        comments: newComments
    }
}

export function loading(loading) {
    return {
        type: types.LOADING,
        loading: loading
    }
}

export function setComment(comment, characters = 0) {
    return {
        type: types.SET_COMMENT,
        comment: comment,
        characters: characters
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

export function setAddedComment(comment) {
    return {
        type: types.SET_ADDED_COMMENT,
        addedComment: comment
    }
}

export function removeAddedComment() {
    return {
        type: types.REMOVE_ADDED_COMMENT,
        addedComment: null
    }
}

export function openComment(comments) {
    return {
        type: types.OPEN_COMMENT,
        comments: comments
    }
}

export function asyncSetComments(comment, articleId) {
    return async function(dispatch){
        try {
            dispatch(loading(true))
            
            await dispatch(asyncPostComment(articleId, comment));
            let newComment = comment.comment = "";
            await dispatch(asyncLoadArticle(articleId));
            await dispatch(setComment(newComment));
        } catch (error) {
            console.log(error);
        } finally {
            dispatch(loading(false))
        }
    }
}

export const asyncLoadArticle = (article_id) => {
    return async function(dispatch){
        try {
            const response = await get(apiUrls.getArticle.replace('{article_id}', article_id))
            dispatch(reveiveArticle(response))
        } catch (error) {
            console.log(error);
        }
    }
}

export const asyncLoadArticleComments = (article_id) => {
    return async function(dispatch){
        try {
            dispatch(loading(true))
            const response = await get(apiUrls.getArticleComments.replace('{article_id}', article_id))
            dispatch(receiveArticleComments(response))
            return response;
        } catch (error) {
            console.log(error);
        } finally {
            dispatch(loading(false));
        }
    }
}

export const asyncPostComment = (articleId, comment) => {
    return async function(dispatch) {
        try {
            dispatch(loading(true));
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

            return await post(apiUrls.createComment, payload).then((response) => {
                dispatch(setAddedComment(response))
                dispatch(asyncLoadArticleComments(articleId));
            });
        } catch (error) {
            console.log(error);
        } finally {
            dispatch(loading(false))
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

export const openCommentBox = (comments, opened, commentId) => {
    return function(dispatch) {
        try {

            let newComments = changeOneChildren(comments, opened, commentId);
            dispatch(openComment(newComments));
        } catch (error) {
            console.log(error)
        }
    }
}