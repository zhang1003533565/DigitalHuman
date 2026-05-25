package com.digitalhuman.backend_java.model;

import jakarta.persistence.*;

@Entity
@Table(name = "model_action",
       uniqueConstraints = @UniqueConstraint(columnNames = {"model_id", "action_key"}))
public class ModelAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private DigitalHumanModel model;

    @Column(name = "action_key", nullable = false, length = 100)
    private String actionKey;

    @Column(name = "action_name", length = 200)
    private String actionName;

    @Column(name = "motion_file_path", nullable = false, length = 500)
    private String motionFilePath;

    @Column(name = "group_name", length = 50)
    private String groupName;

    @Column(name = "action_index")
    private Integer actionIndex;

    @Column
    private Boolean enabled = false;

    public ModelAction() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public DigitalHumanModel getModel() {
        return model;
    }

    public void setModel(DigitalHumanModel model) {
        this.model = model;
    }

    public String getActionKey() {
        return actionKey;
    }

    public void setActionKey(String actionKey) {
        this.actionKey = actionKey;
    }

    public String getActionName() {
        return actionName;
    }

    public void setActionName(String actionName) {
        this.actionName = actionName;
    }

    public String getMotionFilePath() {
        return motionFilePath;
    }

    public void setMotionFilePath(String motionFilePath) {
        this.motionFilePath = motionFilePath;
    }

    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    public Integer getActionIndex() {
        return actionIndex;
    }

    public void setActionIndex(Integer actionIndex) {
        this.actionIndex = actionIndex;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }
}
