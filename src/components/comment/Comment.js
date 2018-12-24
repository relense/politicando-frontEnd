import React, { Component } from 'react';
import { connect } from 'react-redux'
import './Comment.css';
import moment from 'moment'
import { checkDarkMode, checkDarkModeLinks } from '../../utils/CheckDarkMode.js';
import CustomEditor from '../customEditor/CustomEditor.js';

class Comment extends Component {
  constructor(props) {
    super(props);
    this.state = {
      reply: false,
      opened: this.props.opened ? this.props.opened : true,
      child: null
    }
  }

  /**
   * Function to change if the edito box is open or not. If the reply state is true or false
   */
  reply = () =>{
    this.setState({
      reply: !this.state.reply
    }, () => {
      if(this.state.reply) {
        this.props.changeEditorIndex(this.props.commentId)
      }
    })
  }

  /**
   * Function used to know if a comment is opened or closed.
   * This will also be used to verify if a reply editor is opened and it will close it.
   * It will also close all the child that the comment may have open inside.
   */
  opened = () => {
    this.setState({
      reply: this.state.opened ? true : false,
      opened: !this.state.opened
    })

    if(this.state.child !== null) {
      this.setState({
        child: null
      })
    } 
  }

  /**
   * Function that is passed to the editor. The point is to help the user and show where his reply his.
   * 
   * WIP..
   */
  onChildrenClick = (comment) => {
      this.setState({
        child: this.state.child === null ? comment : comment.id !== this.state.child.id ? comment : null
      })
  }

  /**
   * Function to draw in the header the replys to a comment. This will help to navigate throught the comments.
   * 
   * Needs to get a hilight of when a child is selected.
   */
  setChildren = () => {
    if(this.props.comment.children !== undefined && this.props.comment.children !== null) {
     return this.props.comment.children.map((item) => 
      <div className={'childrenContainer commentPointer' + checkDarkModeLinks(this.props.darkMode)} key={item.id} onClick={() => this.onChildrenClick(item)}>
        {(item.username !== null ? item.username : 'anon') + item.id}
      </div>
      )
    }
  }

  /**
   * Function used to draw the header of a comments.
   * Includes open a close button
   * Includes the usernameId of the poster
   * The time it was posted
   * The replys associated with the comment if they exist.
   */
  commentHeader = () => {
    return(
      <div className="commentHeader">
        <div onClick={this.opened}>{this.props.opened !== undefined ? this.props.opened ? "[-]" : "[+]" : this.state.opened ? "[-]" : "[+]"}</div>
        
        <div className={'commentPointer commentUsernameContainer' + checkDarkModeLinks(this.props.darkMode)} onClick={this.reply}>
          {this.props.comment.username ? this.props.comment.username + this.props.comment.id : "anon" + this.props.comment.id}
        </div>

        <div className="answer"> | </div>
        <div className="selectForbiden commentTime">{moment(this.props.comment.created_at).format('DD-MM-YYYY | HH:mm')}</div>

        {this.state.opened ? 
          <div className="childrenContainer">
            {this.setChildren()}
          </div> 
          : 
          <div className="childrenContainer">
            {(this.props.comment.children !== undefined ? this.props.comment.children.length : 0 ) + ' respostas'}
          </div>
        }

      </div>
    )
  }

  /**
   * Function used to draw the footer of the comment.
   * Only has the reply button yet.
   */
  commentFooter = () => {
    return (
      <div className="commentFooter">
        <div className="commentPointer replyButton" onClick={this.reply} >responder</div>
      </div>
    )
  }

  /**
   * Function to return the content of the comment in question.
   */
  commentContent = () => {
    return (
      <div className="commentContent">
        {this.props.comment.comment}
      </div>
    )
  }

  render() {
    return (
      <div>
        <div id={this.props.comment.id} className={'commentParentContainer' + checkDarkMode(this.props.darkMode, true)}>
          {this.commentHeader()} 
          <div style={{display: this.props.opened !== undefined ? this.props.opened ? '' : 'none' : this.state.opened ? '' : 'none'}}>
            {this.commentContent()}
            {this.commentFooter()}
          </div>        
          {this.state.reply && this.state.opened && this.props.editorIndex &&
            <CustomEditor 
              articleId={this.props.id}
              commentType={"reply"}
              commentId={this.props.commentId}
              closeReplyBox={this.reply}
              reply={this.state.reply}
              focusReply={this.onChildrenClick}
            />
          }
          {this.state.child !== null && 
            <Comment comment={this.state.child} 
                      commentId={this.state.child.id} 
                      id={this.props.id} 
                      opened={this.state.opened} 
                      changeEditorIndex={this.props.changeEditorIndex} 
                      editorIndex={this.props.editorIndexState === this.state.child.id ? true : false } 
                      editorIndexState={this.props.editorIndexState} 
            />}
        </div>
      </div>
    )
  }
}

function mapStateToProps(state) {
  return {
    darkMode: state.view.darkMode,
    currentArticle: state.article.currentArticle
  };
}

function mapDispatchToProps() {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Comment);
