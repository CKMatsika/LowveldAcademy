import React, { useState, useEffect } from 'react';
import { Card, Tabs, DatePicker, Select, Button, Table, Space, message } from 'antd';
import { DownloadOutlined, FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import { api } from '../lib/api';
import type { TabsProps } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface ReportData {
  key: string;
  [key: string]: any;
}

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedClass, setSelectedClass] = useState<string>();
  const [selectedStudent, setSelectedStudent] = useState<string>();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [activeTab, setActiveTab] = useState('attendance');

  // Fetch classes and students for filters
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesRes, studentsRes] = await Promise.all([
          api.get('/api/classes'),
          api.get('/api/students'),
        ]);
        setClasses(classesRes.data || []);
        setStudents(studentsRes.data || []);
      } catch (error) {
        message.error('Failed to load filter data');
      }
    };
    fetchData();
  }, []);

  // Fetch report data when filters change
  useEffect(() => {
    fetchReportData();
  }, [activeTab, dateRange, selectedClass, selectedStudent]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
        classId: selectedClass,
        studentId: selectedStudent,
      };

      let endpoint = '';
      if (activeTab === 'attendance') {
        endpoint = '/api/reports/attendance';
      } else if (activeTab === 'performance') {
        endpoint = '/api/reports/performance';
      }

      const response = await api.get(endpoint, { params });
      setReportData(response.data || []);
    } catch (error) {
      message.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    // This would call your backend export endpoint
    message.info(`Exporting ${activeTab} report to ${format.toUpperCase()}`);
    // Implementation would depend on your backend export functionality
  };

  const attendanceColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Student', dataIndex: 'student_name', key: 'student' },
    { title: 'Class', dataIndex: 'class_name', key: 'class' },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    { title: 'Notes', dataIndex: 'notes', key: 'notes' },
  ];

  const performanceColumns = [
    { title: 'Assessment', dataIndex: 'assessment_name', key: 'assessment' },
    { title: 'Student', dataIndex: 'student_name', key: 'student' },
    { title: 'Class', dataIndex: 'class_name', key: 'class' },
    { title: 'Score', dataIndex: 'score', key: 'score' },
    { title: 'Grade', dataIndex: 'grade', key: 'grade' },
    { title: 'Feedback', dataIndex: 'feedback', key: 'feedback' },
  ];

  const items: TabsProps['items'] = [
    {
      key: 'attendance',
      label: 'Attendance',
      children: (
        <Table
          columns={attendanceColumns}
          dataSource={reportData}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'performance',
      label: 'Performance',
      children: (
        <Table
          columns={performanceColumns}
          dataSource={reportData}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card
        title="Reports"
        extra={
          <Space>
            <Button
              icon={<FilePdfOutlined />}
              onClick={() => handleExport('pdf')}
              disabled={reportData.length === 0}
            >
              Export PDF
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => handleExport('excel')}
              disabled={reportData.length === 0}
            >
              Export Excel
            </Button>
          </Space>
        }
      >
        <div className="mb-6">
          <Space size="large">
            <div>
              <div className="text-sm font-medium mb-1">Date Range</div>
              <RangePicker
                value={dateRange as any}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
                style={{ width: 300 }}
              />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Class</div>
              <Select
                style={{ width: 200 }}
                placeholder="Select Class"
                allowClear
                onChange={setSelectedClass}
                value={selectedClass}
              >
                {classes.map((cls) => (
                  <Option key={cls.id} value={cls.id}>
                    {cls.name}
                  </Option>
                ))}
              </Select>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Student</div>
              <Select
                style={{ width: 200 }}
                placeholder="Select Student"
                allowClear
                onChange={setSelectedStudent}
                value={selectedStudent}
              >
                {students.map((student) => (
                  <Option key={student.id} value={student.id}>
                    {student.name}
                  </Option>
                ))}
              </Select>
            </div>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={fetchReportData}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={items}
          tabBarExtraContent={{
            right: (
              <div className="text-sm text-gray-500">
                Showing {reportData.length} records
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default Reports;
