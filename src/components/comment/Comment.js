import React, { Component } from 'react';
import { connect } from 'react-redux'
import './Comment.css';
import { asyncSetReply, openCloseCommentBox, setChildComments } from '../../redux/actions/articleActions';
import moment from 'moment'
import { checkDarkMode, checkDarkModeLinks } from '../../utils/CheckDarkMode.js';
import CustomEditor from '../customEditor/CustomEditor.js';

class Comment extends Component {
  constructor(props){
    super(props);
    this.state = {
        isHovered: false,
        itemId: null
    };
}

handleHover = (itemId) => {
  this.setState({
      isHovered: !this.state.isHovered,
      itemId: itemId
  });
}

  reply = () => {
    this.props.changeReplyAndEditor(this.props.commentId, this.props.editorIndex);
  }

  opened = () => {
    this.props.setCommentBoxState(this.props.currentArticleComments, this.props.comment.opened, this.props.comment.id);
  }

  onChildrenClick = (child) => {
    this.props.setChildComments(this.props.currentArticleComments, child);
  }
  
  /**
   * Function to draw in the header the replys to a comment. This will help to navigate throught the comments.
   */
  setChildren = () => {
    return (
      this.props.currentArticleComments.map((item) => {
        if(item.comments_id !== null && this.props.comment.id === item.comments_id) { 
          return (<div onMouseEnter={() => this.handleHover(item.id)} onMouseLeave={() => this.handleHover(null)} className={'childrenContainer commentPointer selectForbiden' 
            + (this.props.comment.child !== null ? (this.props.comment.child.id === item.id ? " hilighlightChild" : "") : "")
            + checkDarkModeLinks(this.props.darkMode, true)} 
            key={item.id} 
            onClick={() => this.onChildrenClick(item)}
          >
            {(item.username !== null ? item.username : 'anon') + item.id}
            <div className={this.state.isHovered && this.state.hoveredItem !== null && item.id === this.state.itemId ? "commentSpy" : "noDisplay"}>
              <div className="commentHeader">
                <div className={'commentPointer' + checkDarkModeLinks(this.props.darkMode, true)}>
                  {item.username ? item.username + item.id : "anon" + item.id}
                </div>
                <div className="answer"> | </div>
                <div className="selectForbiden commentTime">
                  {moment(item.created_at).format('DD-MM-YYYY | HH:mm')}
                </div>
                <div>
                  {item.children + ' respostas'}
                </div>
              </div>
              <div className={"commentContent" + checkDarkMode(this.props.darkMode, true)}>
                {item.comment}
              </div>
            </div>
          </div>
        )
      }

      return null;
    }));
  }

  /**
   * Function used to draw the header of a comments. Includes open a close button.
   * Includes the usernameId of the poster. The time it was posted. The replys associated with the comment if they exist.
   */
  commentHeader = () => {
    let sign = this.props.comment.opened ? "[-]" : "[+]";
    let username = this.props.comment.username ? this.props.comment.username + this.props.comment.id : "anon" + this.props.comment.id;
    let time = moment(this.props.comment.created_at).format('DD-MM-YYYY | HH:mm');
    let parentName = this.props.comment.parent_username !== null ? this.props.comment.parent_username + this.props.comment.comments_id : this.props.comment.comments_id !== null ? "anon" + this.props.comment.comments_id : "";

    return(
      <div className="commentHeader">
        <div className="sign" onClick={this.opened}>
          {sign}
        </div>
        <div className={'commentUsernameContainer' + checkDarkModeLinks(this.props.darkMode, true)}>
          {username}
        </div>
        {parentName !== "" && "resposta a"}
        {parentName !== "" && 
          <div className={'commentParentUsernameContainer' + checkDarkModeLinks(this.props.darkMode, true)}>
            {parentName}
          </div>
        }
        <div className="answer"> | </div>
        <div className="selectForbiden commentTime">
          {time}
        </div>
        {this.props.comment.opened ? 
           this.setChildren()
          : 
          <div className="childrenContainer">
            {this.props.comment.children + ' respostas'}
          </div>
        }
      </div>
    )
  }

  /**
   * Function to render the reply box
   */
  renderEditor = () => {
    if(this.props.reply && this.props.comment.opened && this.props.editorIndexState) 
      return <CustomEditor commentType={"reply"} commentId={this.props.commentId} closeReplyBox={this.reply} />
    else 
      return null
  }

  /**
   * Function to render the child comment when it is clicked
   */
  renderChildComment = () => {
    if(this.props.comment.child !== null && this.props.comment.child !== undefined)
      return <ConnectedComment comment={this.props.comment.child} commentId={this.props.comment.child.id} editorIndexState={this.props.editorIndex === this.props.comment.child.id ? true : false } />
    else 
      return null
  }

  render() {
    let renderer;

    if(this.props.currentArticle !== null && this.props.currentArticle !== undefined && this.props.comment !== null) {
      renderer = (
        <div id={this.props.comment.id} className={this.props.comment.comments_id !== null ? 'replyCommentPadding commentParentContainer' : 'commentParentContainer'  + checkDarkMode(this.props.darkMode, true)}>
          {this.commentHeader()} 
          <div style={{display: this.props.comment.opened ? '' : 'none'}}>
            <div className={"commentContent" + checkDarkMode(this.props.darkMode, true)}>
              {this.props.comment.comment}
            </div>
            {this.renderEditor()}
            <div className="commentFooter">
              <div className={"commentPointer replyButton" + checkDarkModeLinks(this.props.darkMode, true)} onClick={this.reply}>responder</div>
            </div>
          </div>        
         {this.renderChildComment()}
        </div>
      );
    } else 
      renderer = null;
    
    return renderer;
  }
}

function mapStateToProps(state) {
  return {
    darkMode: state.view.darkMode,
    currentArticle: state.article.currentArticle,
    currentArticleComments: state.article.currentArticleComments,
    editorIndex: state.article.editorIndex,
    reply: state.article.reply,
  };
}

function mapDispatchToProps(dispatch) {
  return { 
    changeReplyAndEditor: (commentId, editorIndex) => {
      dispatch(asyncSetReply(commentId, editorIndex))
    },
    setCommentBoxState: (comments, opened, commentId) => {
      dispatch(openCloseCommentBox(comments, opened, commentId))
    },
    setChildComments: (comments, child) => {
      dispatch(setChildComments(comments, child))
    }
  };
}

const ConnectedComment = connect(mapStateToProps, mapDispatchToProps)(Comment);
export default ConnectedComment;